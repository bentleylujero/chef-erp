import { NextRequest, NextResponse } from "next/server";
import Fuse from "fuse.js";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { generatedRecipeSchema } from "@/lib/ai/output-schemas";
import { buildBatchGenerationPrompt } from "@/lib/ai/generation-prompts";
import { isDuplicate } from "@/lib/engines/deduplicator";
import type {
  Cuisine,
  Technique,
  GenerationTrigger,
  RecipeSource,
} from "@prisma/client";

const TRIGGER_TO_SOURCE: Record<string, RecipeSource> = {
  ONBOARDING_BATCH: "AI_BATCH",
  NEW_INGREDIENTS: "AI_INGREDIENT_FILL",
  CUISINE_EXPLORATION: "AI_CUISINE_EXPLORE",
  PREFERENCE_DRIFT: "AI_PREFERENCE_DRIFT",
  EXPIRY_RESCUE: "AI_EXPIRY_RESCUE",
  CHAT_REQUEST: "AI_CHAT",
  MANUAL_REQUEST: "AI_BATCH",
  INGREDIENT_FILL: "AI_INGREDIENT_FILL",
};

const VALID_TRIGGERS = new Set<string>([
  "ONBOARDING_BATCH",
  "NEW_INGREDIENTS",
  "CUISINE_EXPLORATION",
  "PREFERENCE_DRIFT",
  "EXPIRY_RESCUE",
  "CHAT_REQUEST",
  "MANUAL_REQUEST",
  "INGREDIENT_FILL",
]);

const VALID_CUISINES = new Set<string>([
  "FRENCH",
  "ITALIAN",
  "DELI",
  "MEXICAN",
  "MEDITERRANEAN",
  "JAPANESE",
  "THAI",
  "KOREAN",
  "CHINESE",
  "INDIAN",
  "AMERICAN",
  "MIDDLE_EASTERN",
  "AFRICAN",
  "CARIBBEAN",
  "SOUTHEAST_ASIAN",
  "FUSION",
  "OTHER",
]);

const VALID_TECHNIQUES = new Set<string>([
  "BRAISE",
  "SAUTE",
  "ROAST",
  "GRILL",
  "POACH",
  "STEAM",
  "FRY",
  "DEEP_FRY",
  "CURE",
  "SMOKE",
  "FERMENT",
  "EMULSIFY",
  "LAMINATE",
  "SOUS_VIDE",
  "BLANCH",
  "DEGLAZE",
  "FLAMBE",
  "CONFIT",
  "REDUCE",
  "CARAMELIZE",
  "PICKLE",
  "BRINE",
  "MARINATE",
  "SEAR",
  "STEW",
  "BAKE",
  "BROIL",
  "WHISK",
  "KNEAD",
  "FOLD",
  "TEMPER",
  "CLARIFY",
  "RENDER",
  "CHIFFONADE",
  "BRUNOISE",
  "JULIENNE",
  "MINCE",
  "OTHER",
]);

function toCuisine(raw: string): Cuisine {
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (VALID_CUISINES.has(normalized)) return normalized as Cuisine;
  return "OTHER" as Cuisine;
}

function toTechnique(raw: string): Technique {
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (VALID_TECHNIQUES.has(normalized)) return normalized as Technique;
  return "OTHER" as Technique;
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export async function POST(request: NextRequest) {
  let jobId: string | null = null;

  try {
    const body = await request.json();
    const { userId, trigger, targetCuisine, count: rawCount } = body as {
      userId: string;
      trigger: string;
      targetCuisine?: string;
      count?: number;
    };

    if (!userId || !trigger) {
      return NextResponse.json(
        { error: "userId and trigger are required" },
        { status: 400 },
      );
    }

    if (!VALID_TRIGGERS.has(trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger: ${trigger}` },
        { status: 400 },
      );
    }

    const count = Math.max(1, Math.min(rawCount ?? 10, 20));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cookingStyle: true,
        inventory: {
          where: { quantity: { gt: 0 } },
          include: { ingredient: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.inventory.length === 0) {
      return NextResponse.json(
        { error: "Pantry is empty — add ingredients before generating recipes" },
        { status: 400 },
      );
    }

    const job = await prisma.generationJob.create({
      data: {
        userId,
        trigger: trigger as GenerationTrigger,
        inputContext: {
          pantrySize: user.inventory.length,
          targetCuisine: targetCuisine ?? null,
          requestedCount: count,
        },
        status: "RUNNING",
      },
    });
    jobId = job.id;

    const existingRecipes = await prisma.recipe.findMany({
      where: { generationJob: { userId } },
      select: { title: true },
    });

    const ingredients = user.inventory.map((inv) => ({
      id: inv.ingredient.id,
      name: inv.ingredient.name,
      category: inv.ingredient.category,
    }));

    const prompt = buildBatchGenerationPrompt({
      ingredients,
      cookingStyle: {
        primaryCuisines:
          (user.cookingStyle?.primaryCuisines as string[]) ?? [],
        preferredTechniques:
          (user.cookingStyle?.preferredTechniques as string[]) ?? [],
        cookingPhilosophy: user.cookingStyle?.cookingPhilosophy ?? null,
      },
      skillLevel: user.skillLevel,
      equipment: user.kitchenEquipment,
      targetCuisine,
      count,
      existingTitles: existingRecipes.map((r) => r.title),
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const tokensUsed = completion.usage?.total_tokens ?? 0;
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const estimatedCost =
      (promptTokens * 2.5 + completionTokens * 10) / 1_000_000;

    let rawData: Record<string, unknown>;
    try {
      rawData = JSON.parse(content);
    } catch {
      throw new Error("OpenAI returned invalid JSON");
    }

    const rawRecipes = Array.isArray(rawData.recipes) ? rawData.recipes : [];
    if (rawRecipes.length === 0) throw new Error("No recipes in AI response");

    const allIngredients = await prisma.ingredient.findMany({
      select: { id: true, name: true },
    });

    const ingredientFuse = new Fuse(allIngredients, {
      keys: ["name"],
      threshold: 0.4,
      includeScore: true,
    });

    const pantrySnapshot = user.inventory.map((inv) => inv.ingredientId);
    const source = (TRIGGER_TO_SOURCE[trigger] ?? "AI_BATCH") as RecipeSource;

    const createdRecipes: Awaited<ReturnType<typeof prisma.recipe.create>>[] =
      [];

    for (const raw of rawRecipes) {
      const result = generatedRecipeSchema.safeParse(raw);
      if (!result.success) continue;

      const recipe = result.data;
      const cuisineEnum = toCuisine(recipe.cuisine);
      const ingredientNames = recipe.ingredients.map((i) => i.ingredientName);

      const dupCheck = await isDuplicate(
        recipe.title,
        ingredientNames,
        cuisineEnum,
      );
      if (dupCheck.isDuplicate) continue;

      const matchedIngredients: Array<{
        ingredientId: string;
        quantity: number;
        unit: string;
        isOptional: boolean;
        prepNote: string | null;
      }> = [];

      const seenIngredientIds = new Set<string>();

      for (const gen of recipe.ingredients) {
        const hits = ingredientFuse.search(gen.ingredientName);
        if (hits.length === 0) continue;

        const best = hits[0];
        if (best.score !== undefined && best.score > 0.4) continue;
        if (seenIngredientIds.has(best.item.id)) continue;

        seenIngredientIds.add(best.item.id);
        matchedIngredients.push({
          ingredientId: best.item.id,
          quantity: gen.quantity,
          unit: gen.unit,
          isOptional: gen.isOptional,
          prepNote: gen.prepNote ?? null,
        });
      }

      if (matchedIngredients.length < recipe.ingredients.length * 0.5) continue;

      const techniques = dedupe(recipe.techniques.map(toTechnique));

      try {
        const created = await prisma.recipe.create({
          data: {
            title: recipe.title,
            description: recipe.description,
            cuisine: cuisineEnum,
            difficulty: recipe.difficulty,
            techniques,
            instructions: recipe.instructions as object[],
            prepTime: recipe.prepTime,
            cookTime: recipe.cookTime,
            servings: recipe.servings,
            flavorTags: recipe.flavorTags,
            tags: recipe.tags,
            source,
            generationJobId: jobId,
            pantrySnapshotAtGen: pantrySnapshot,
            ingredients: { create: matchedIngredients },
          },
          include: {
            ingredients: { include: { ingredient: true } },
          },
        });
        createdRecipes.push(created);
      } catch {
        // Individual recipe creation failed — continue with the rest
      }
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        recipesGenerated: createdRecipes.length,
        tokensUsed,
        estimatedCost,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      jobId,
      recipesGenerated: createdRecipes.length,
      recipes: createdRecipes,
      tokensUsed,
      estimatedCost,
    });
  } catch (error) {
    if (jobId) {
      await prisma.generationJob
        .update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        })
        .catch(() => {});
    }

    const message =
      error instanceof Error ? error.message : "Recipe generation failed";
    return NextResponse.json({ error: message, jobId }, { status: 500 });
  }
}
