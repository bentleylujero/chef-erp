import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateFlavorProfileFromSignals } from "@/lib/engines/preference-aggregator";
import { Technique, type Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApiUserId } from "@/lib/auth/api-user";
import { deductPantryForCookedRecipe } from "@/lib/engines/inventory-cook-deduction";

const TECHNIQUE_SET = new Set<string>(Object.values(Technique));

type RecipeTechniqueSource = {
  techniques: Technique[];
  instructions: Prisma.JsonValue;
};

function parseTechniqueFromString(raw: string | undefined | null): Technique | null {
  if (!raw?.trim()) return null;
  const normalized = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  if (TECHNIQUE_SET.has(normalized)) return normalized as Technique;
  return null;
}

function collectRecipeTechniques(
  recipe: Pick<RecipeTechniqueSource, "techniques" | "instructions">,
): Technique[] {
  const out = new Set<Technique>();
  for (const t of recipe.techniques) out.add(t);
  const steps = recipe.instructions;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (step && typeof step === "object" && "technique" in step) {
        const tech = (step as { technique?: string }).technique;
        const parsed = parseTechniqueFromString(tech);
        if (parsed) out.add(parsed);
      }
    }
  }
  return [...out];
}

const cookingLogBodySchema = z.object({
  recipeId: z.string().min(1),
  actualPrepTime: z.number().int().nonnegative().optional(),
  actualCookTime: z.number().int().nonnegative().optional(),
  servingsCooked: z.number().int().positive().optional(),
  notes: z.string().optional(),
  photoUrls: z.array(z.string().min(1)).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const json = await request.json();
    const parsed = cookingLogBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const {
      recipeId,
      actualPrepTime,
      actualCookTime,
      servingsCooked,
      notes,
      photoUrls,
      rating,
    } = parsed.data;

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        status: true,
        cuisine: true,
        techniques: true,
        instructions: true,
      },
    });

    if (!recipe || recipe.status !== "active") {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const techniques = collectRecipeTechniques(recipe);
    const cookedAt = new Date();

    const metadata: Prisma.InputJsonValue = {
      cookedAt: cookedAt.toISOString(),
      ...(rating != null ? { rating } : {}),
      ...(actualPrepTime != null ? { actualPrepTime } : {}),
      ...(actualCookTime != null ? { actualCookTime } : {}),
      ...(servingsCooked != null ? { servingsCooked } : {}),
    };

    const pantry = await prisma.$transaction(async (tx) => {
      await tx.cookingLog.create({
        data: {
          userId,
          recipeId,
          actualPrepTime: actualPrepTime ?? null,
          actualCookTime: actualCookTime ?? null,
          servingsCooked: servingsCooked ?? null,
          notes: notes ?? null,
          photoUrls: photoUrls ?? [],
        },
      });

      await tx.recipe.update({
        where: { id: recipeId },
        data: { totalCooks: { increment: 1 } },
      });

      await tx.preferenceSignal.create({
        data: {
          userId,
          signalType: "COOKED",
          entityType: "RECIPE",
          entityId: recipeId,
          metadata,
        },
      });

      for (const technique of techniques) {
        await tx.techniqueLog.upsert({
          where: {
            userId_technique: {
              userId,
              technique,
            },
          },
          create: {
            userId,
            technique,
            cuisine: recipe.cuisine,
            timesPerformed: 1,
            lastPerformed: cookedAt,
          },
          update: {
            timesPerformed: { increment: 1 },
            lastPerformed: cookedAt,
            cuisine: recipe.cuisine,
          },
        });
      }

      if (rating != null) {
        await tx.recipeRating.create({
          data: {
            userId,
            recipeId,
            rating,
            notes: notes ?? null,
            cookedAt,
          },
        });

        const agg = await tx.recipeRating.aggregate({
          where: { recipeId },
          _avg: { rating: true },
        });
        await tx.recipe.update({
          where: { id: recipeId },
          data: { avgRating: agg._avg.rating ?? rating },
        });
      }

      return deductPantryForCookedRecipe(tx, {
        userId,
        recipeId,
        servingsCooked,
      });
    });

    await updateFlavorProfileFromSignals(userId);

    return NextResponse.json(
      { ok: true, recipeId, pantry },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to log cooking session" },
      { status: 500 },
    );
  }
}
