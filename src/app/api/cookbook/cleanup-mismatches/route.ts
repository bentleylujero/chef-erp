import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { RecipeSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUserId } from "@/lib/auth/api-user";
import { auditRecipeTextVsIngredients } from "@/lib/engines/recipe-text-ingredient-audit";

const AI_SOURCES: RecipeSource[] = [
  "AI_BATCH",
  "AI_SINGLE",
  "AI_CHAT",
  "AI_CUISINE_EXPLORE",
  "AI_EXPIRY_RESCUE",
  "AI_PREFERENCE_DRIFT",
  "AI_INGREDIENT_FILL",
  "AI_PANTRY_BRIDGE",
  "AI_NETWORK_MESH",
];

const bodySchema = z.object({
  dryRun: z.boolean().optional().default(true),
  scanInstructions: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { dryRun, scanInstructions } = parsed.data;

    const recipes = await prisma.recipe.findMany({
      where: {
        status: "active",
        source: { in: AI_SOURCES },
        generationJob: { is: { userId } },
      },
      select: {
        id: true,
        title: true,
        description: true,
        instructions: true,
        source: true,
        generationJobId: true,
        ingredients: {
          select: { ingredient: { select: { name: true } } },
        },
      },
    });

    const flagged: Array<{
      id: string;
      title: string;
      mismatches: string[];
      source: string;
      generationJobId: string | null;
    }> = [];

    for (const r of recipes) {
      const names = r.ingredients.map((ri) => ri.ingredient.name);
      const { mismatches } = auditRecipeTextVsIngredients({
        title: r.title,
        description: r.description,
        instructions: r.instructions,
        ingredientNames: names,
        scanInstructions,
      });
      if (mismatches.length > 0) {
        flagged.push({
          id: r.id,
          title: r.title,
          mismatches,
          source: r.source,
          generationJobId: r.generationJobId,
        });
      }
    }

    if (!dryRun && flagged.length > 0) {
      await prisma.recipe.updateMany({
        where: { id: { in: flagged.map((f) => f.id) } },
        data: { status: "archived" },
      });
    }

    return NextResponse.json({
      dryRun,
      scanned: recipes.length,
      flaggedCount: flagged.length,
      archivedCount: dryRun ? 0 : flagged.length,
      flagged,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
