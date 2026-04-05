import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai, OPENAI_MODEL_JSON } from "@/lib/openai";
import { z } from "zod";
import { buildCuisineKitPrompt } from "@/lib/ai/cuisine-kit-prompt";
import { requireApiUserId } from "@/lib/auth/api-user";
import { tryResolveIngredientName } from "@/lib/engines/ingredient-resolve";

const requestSchema = z.object({
  cuisine: z.string().min(1),
});

const pantryItemSchema = z.object({
  name: z.string(),
  category: z.enum(["ESSENTIAL", "RECOMMENDED", "NICE_TO_HAVE"]),
  description: z.string(),
  substitutes: z.array(z.string()).default([]),
});

const techniquePathSchema = z.object({
  technique: z.string(),
  order: z.number(),
  bridgeNote: z.string(),
  keyDishes: z.array(z.string()),
  difficulty: z.number().min(1).max(5),
});

const recipeLadderSchema = z.object({
  title: z.string(),
  difficulty: z.number().min(1).max(5),
  description: z.string(),
  keyIngredients: z.array(z.string()),
  keyTechnique: z.string(),
  accessibilityNote: z.string(),
});

const cuisineKitResponseSchema = z.object({
  pantryKit: z.array(pantryItemSchema),
  techniquePath: z.array(techniquePathSchema),
  recipeLadder: z.array(recipeLadderSchema),
});

const PRIORITY_MAP = {
  ESSENTIAL: "ESSENTIAL",
  RECOMMENDED: "RECOMMENDED",
  NICE_TO_HAVE: "NICE_TO_HAVE",
} as const;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { cuisine } = parsed.data;

    const existing = await prisma.cuisineExploration.findUnique({
      where: { userId_cuisine: { userId, cuisine: cuisine as never } },
      include: {
        starterItems: { include: { ingredient: true } },
      },
    });

    if (existing?.starterKitData && existing?.techniquePathData) {
      return NextResponse.json(existing);
    }

    const [cookingStyle, pantryItems] = await Promise.all([
      prisma.cookingStyle.findUnique({
        where: { userId },
      }),
      prisma.inventory.findMany({
        where: { userId },
        include: { ingredient: { select: { name: true } } },
      }),
    ]);

    const prompt = buildCuisineKitPrompt({
      cuisine,
      userPrimaryCuisines: cookingStyle?.primaryCuisines ?? [],
      userPreferredTechniques: cookingStyle?.preferredTechniques ?? [],
      existingPantry: pantryItems.map((i) => i.ingredient.name),
    });

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_JSON,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.55,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "Empty AI response" },
        { status: 502 },
      );
    }

    const aiData = cuisineKitResponseSchema.safeParse(JSON.parse(raw));
    if (!aiData.success) {
      return NextResponse.json(
        { error: "Invalid AI response format", details: aiData.error.issues },
        { status: 502 },
      );
    }

    const { pantryKit, techniquePath, recipeLadder } = aiData.data;

    const ingredientMap = new Map<string, string>();
    for (const item of pantryKit) {
      const resolved = await tryResolveIngredientName(prisma, item.name);
      if (resolved) {
        ingredientMap.set(item.name, resolved.ingredientId);
      }
    }

    const exploration = await prisma.cuisineExploration.upsert({
      where: { userId_cuisine: { userId, cuisine: cuisine as never } },
      update: {
        starterKitData: pantryKit,
        techniquePathData: techniquePath,
        status: "STOCKING_PANTRY",
      },
      create: {
        userId,
        cuisine: cuisine as never,
        starterKitData: pantryKit,
        techniquePathData: techniquePath,
        status: "STOCKING_PANTRY",
      },
    });

    for (const item of pantryKit) {
      const ingredientId = ingredientMap.get(item.name);
      if (ingredientId) {
        await prisma.cuisineStarterItem.create({
          data: {
            explorationId: exploration.id,
            ingredientId,
            priority: PRIORITY_MAP[item.category],
            description: item.description,
          },
        });
      }
    }

    const result = await prisma.cuisineExploration.findUnique({
      where: { id: exploration.id },
      include: {
        starterItems: { include: { ingredient: true } },
      },
    });

    return NextResponse.json({
      ...result,
      recipeLadder,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate cuisine kit" },
      { status: 500 },
    );
  }
}
