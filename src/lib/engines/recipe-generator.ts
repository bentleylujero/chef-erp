import { prisma } from "@/lib/prisma";
import {
  openai,
  OPENAI_MODEL_JSON,
  estimateOpenAiChatCostUsd,
} from "@/lib/openai";
import { generatedRecipeSchema } from "@/lib/ai/output-schemas";
import { buildBatchGenerationPrompt } from "@/lib/ai/generation-prompts";
import { isDuplicate } from "@/lib/engines/deduplicator";
import {
  checkNetworkMeshGeneration,
  checkPantryBridgeGeneration,
} from "@/lib/engines/generation-trigger";
import { sortIngredientPairIds } from "@/lib/engines/pantry-bridge-heuristics";
import {
  buildPantryExactMap,
  createPantryFuse,
  matchNameToPantryRow,
} from "@/lib/engines/pantry-ingredient-match";
import { getPantryNetworkHubIngredientNames } from "@/lib/engines/topology-builder";
import type {
  Cuisine,
  Technique,
  GenerationTrigger,
  RecipeSource,
} from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────────

export interface PantryBridgePairPayload {
  ingredientIdA: string;
  ingredientIdB: string;
  nameA: string;
  nameB: string;
}

export interface GenerateBatchParams {
  userId: string;
  trigger: string;
  targetCuisine?: string;
  count?: number;
  bridgePairs?: PantryBridgePairPayload[];
  focusIngredientIds?: string[];
  allowedCuisines?: string[];
  /** For EXPIRY_RESCUE: names of ingredients expiring soon */
  expiringIngredientNames?: string[];
  /** For PREFERENCE_DRIFT: flavor dimensions that drifted */
  driftedDimensions?: Array<{
    dimension: string;
    userValue: number;
    cookbookAvg: number;
  }>;
}

export interface GenerateBatchResult {
  jobId: string | null;
  recipesGenerated: number;
  recipes: unknown[];
  tokensUsed: number;
  estimatedCost: number;
  cached?: boolean;
  reason?: string;
}

// ── Constants ────────────────────────────────────────────────────────

const TRIGGER_TO_SOURCE: Record<string, RecipeSource> = {
  ONBOARDING_BATCH: "AI_BATCH",
  NEW_INGREDIENTS: "AI_INGREDIENT_FILL",
  PANTRY_BRIDGE: "AI_PANTRY_BRIDGE",
  NETWORK_MESH: "AI_NETWORK_MESH",
  CUISINE_EXPLORATION: "AI_CUISINE_EXPLORE",
  PREFERENCE_DRIFT: "AI_PREFERENCE_DRIFT",
  EXPIRY_RESCUE: "AI_EXPIRY_RESCUE",
  CHAT_REQUEST: "AI_CHAT",
  MANUAL_REQUEST: "AI_BATCH",
  INGREDIENT_FILL: "AI_INGREDIENT_FILL",
  COOKBOOK_BUILD: "AI_COOKBOOK_BUILD",
};

const VALID_TRIGGERS = new Set<string>([
  "ONBOARDING_BATCH",
  "NEW_INGREDIENTS",
  "PANTRY_BRIDGE",
  "NETWORK_MESH",
  "CUISINE_EXPLORATION",
  "PREFERENCE_DRIFT",
  "EXPIRY_RESCUE",
  "CHAT_REQUEST",
  "MANUAL_REQUEST",
  "INGREDIENT_FILL",
  "COOKBOOK_BUILD",
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

// ── Helpers ──────────────────────────────────────────────────────────

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

// ── Core Generation ──────────────────────────────────────────────────

/**
 * Core recipe generation logic. Called directly by build, curator, and the API route.
 * No HTTP self-fetch, no auth dependency — caller is responsible for authentication.
 */
export async function generateRecipeBatch(
  params: GenerateBatchParams,
): Promise<GenerateBatchResult> {
  const {
    userId,
    trigger,
    targetCuisine,
    count: rawCount,
    bridgePairs: rawBridgePairs,
    focusIngredientIds: rawFocusIds,
    allowedCuisines: rawAllowedCuisines,
    expiringIngredientNames,
    driftedDimensions,
  } = params;

  let jobId: string | null = null;

  if (!trigger || !VALID_TRIGGERS.has(trigger)) {
    throw new Error(`Invalid or missing trigger: ${trigger}`);
  }

  let bridgePairs: PantryBridgePairPayload[] | undefined = rawBridgePairs;
  const maxCount = trigger === "COOKBOOK_BUILD" ? 25 : 20;
  let count = Math.max(1, Math.min(rawCount ?? 10, maxCount));

  if (trigger === "PANTRY_BRIDGE") {
    if (!bridgePairs?.length) {
      const decision = await checkPantryBridgeGeneration(userId);
      if (!decision.shouldGenerate) {
        throw new Error(decision.reason);
      }
      bridgePairs = decision.context.bridgePairs as PantryBridgePairPayload[];
    }
    count = Math.max(1, Math.min(bridgePairs!.length, 20));
  }

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

  if (!user) throw new Error("User not found");
  if (user.inventory.length === 0) {
    throw new Error("Pantry is empty — add ingredients before generating recipes");
  }

  if (trigger === "NETWORK_MESH") {
    const decision = await checkNetworkMeshGeneration(userId);
    if (!decision.shouldGenerate) {
      throw new Error(decision.reason);
    }
    count = decision.count;
  }

  let networkHubIngredientNames: string[] | undefined;
  let bridgeMinDistinctIngredients: number | undefined;
  if (
    (trigger === "PANTRY_BRIDGE" && bridgePairs?.length) ||
    trigger === "NETWORK_MESH"
  ) {
    networkHubIngredientNames = await getPantryNetworkHubIngredientNames(
      userId,
      28,
    );
    const n = user.inventory.length;
    bridgeMinDistinctIngredients =
      trigger === "NETWORK_MESH"
        ? Math.min(Math.max(5, Math.min(8, n)), n)
        : Math.min(Math.max(3, Math.min(8, n)), n);
  }

  const job = await prisma.generationJob.create({
    data: {
      userId,
      trigger: trigger as GenerationTrigger,
      inputContext: {
        pantrySize: user.inventory.length,
        targetCuisine: targetCuisine ?? null,
        requestedCount: count,
        pantryBridge:
          trigger === "PANTRY_BRIDGE" && bridgePairs
            ? bridgePairs.map((p) => ({ a: p.nameA, b: p.nameB }))
            : undefined,
        pantryBridgeNetworkHubs:
          networkHubIngredientNames?.slice(0, 14) ?? null,
        bridgeMinDistinctIngredients: bridgeMinDistinctIngredients ?? null,
        networkMesh: trigger === "NETWORK_MESH" ? true : null,
        expiryRescue: trigger === "EXPIRY_RESCUE" ? expiringIngredientNames : null,
        preferenceDrift: trigger === "PREFERENCE_DRIFT" ? driftedDimensions : null,
      },
      status: "RUNNING",
    },
  });
  jobId = job.id;

  try {
    // Resolve focus ingredient names for NEW_INGREDIENTS trigger
    let focusIngredientNames: string[] | undefined;
    if (trigger === "NEW_INGREDIENTS" && rawFocusIds?.length) {
      const focusIngredients = await prisma.ingredient.findMany({
        where: { id: { in: rawFocusIds } },
        select: { id: true, name: true },
      });
      focusIngredientNames = focusIngredients.map((i) => i.name);

      const existingCoverage = await prisma.recipeIngredient.findMany({
        where: {
          ingredientId: { in: rawFocusIds },
          recipe: {
            status: "active",
            OR: [{ ownerUserId: null }, { ownerUserId: userId }],
          },
        },
        select: { ingredientId: true, recipeId: true },
        distinct: ["ingredientId"],
      });

      const coveredIds = new Set(existingCoverage.map((r) => r.ingredientId));
      const stillUncovered = rawFocusIds.filter((id) => !coveredIds.has(id));

      if (stillUncovered.length === 0) {
        const cachedRecipeIds = [
          ...new Set(existingCoverage.map((r) => r.recipeId)),
        ];
        const cachedRecipes = await prisma.recipe.findMany({
          where: {
            id: { in: cachedRecipeIds },
            status: "active",
            OR: [{ ownerUserId: null }, { ownerUserId: userId }],
          },
          include: { ingredients: { include: { ingredient: true } } },
        });

        // Mark job as completed with 0 recipes (cached)
        await prisma.generationJob.update({
          where: { id: jobId },
          data: { status: "COMPLETED", recipesGenerated: 0, tokensUsed: 0, estimatedCost: 0, completedAt: new Date() },
        });

        return {
          jobId: null,
          recipesGenerated: 0,
          recipes: cachedRecipes,
          cached: true,
          tokensUsed: 0,
          estimatedCost: 0,
          reason: "All focus ingredients already have recipe coverage — returning existing recipes",
        };
      }

      focusIngredientNames = focusIngredients
        .filter((i) => stillUncovered.includes(i.id))
        .map((i) => i.name);
    }

    const existingRecipes = await prisma.recipe.findMany({
      where: {
        status: "active",
        OR: [{ ownerUserId: null }, { ownerUserId: userId }],
      },
      select: { title: true },
    });

    const ingredients = user.inventory.map((inv) => ({
      id: inv.ingredient.id,
      name: inv.ingredient.name,
      category: inv.ingredient.category,
      catalogTier: inv.ingredient.catalogTier,
    }));

    // RAG: fetch similar recipes from the cookbook embedding index
    let ragContext: string | undefined;
    try {
      const { buildRAGContext } = await import("@/lib/ai/cookbook-retrieval");
      const ragQuery = targetCuisine
        ? `${targetCuisine} recipes with ${ingredients.slice(0, 5).map((i) => i.name).join(", ")}`
        : `recipes with ${ingredients.slice(0, 8).map((i) => i.name).join(", ")}`;
      ragContext = await buildRAGContext(ragQuery, {
        topK: 5,
        cuisineFilter: targetCuisine ?? undefined,
      });
    } catch {
      // RAG is optional
    }

    const isCookbookBuild = trigger === "COOKBOOK_BUILD";
    const userCuisines = [
      ...((user.cookingStyle?.primaryCuisines as string[]) ?? []),
      ...((user.cookingStyle?.exploringCuisines as string[]) ?? []),
    ].filter((c) => VALID_CUISINES.has(c));

    const allowedCuisines = rawAllowedCuisines?.length
      ? rawAllowedCuisines.filter((c) => VALID_CUISINES.has(c))
      : userCuisines.length > 0
        ? userCuisines
        : undefined;

    const prompt = buildBatchGenerationPrompt({
      ingredients,
      cookingStyle: {
        primaryCuisines:
          (user.cookingStyle?.primaryCuisines as string[]) ?? [],
        exploringCuisines:
          (user.cookingStyle?.exploringCuisines as string[]) ?? [],
        preferredTechniques:
          (user.cookingStyle?.preferredTechniques as string[]) ?? [],
        cookingPhilosophy: user.cookingStyle?.cookingPhilosophy ?? null,
      },
      skillLevel: user.skillLevel,
      equipment: user.kitchenEquipment,
      targetCuisine,
      count,
      existingTitles: existingRecipes.map((r) => r.title),
      pantryBridgePairs:
        trigger === "PANTRY_BRIDGE" && bridgePairs?.length
          ? bridgePairs.map((p) => ({ nameA: p.nameA, nameB: p.nameB }))
          : undefined,
      bridgeMinDistinctIngredients,
      networkHubIngredientNames,
      networkMeshMode: trigger === "NETWORK_MESH",
      focusIngredientNames:
        trigger === "NEW_INGREDIENTS" ? focusIngredientNames : undefined,
      ragContext,
      cookbookBuildMode: isCookbookBuild,
      allowedCuisines: allowedCuisines?.length ? allowedCuisines : undefined,
      expiringIngredientNames:
        trigger === "EXPIRY_RESCUE" ? expiringIngredientNames : undefined,
      driftedDimensions:
        trigger === "PREFERENCE_DRIFT" ? driftedDimensions : undefined,
    });

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_JSON,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: isCookbookBuild ? 0.7 : 0.55,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const tokensUsed = completion.usage?.total_tokens ?? 0;
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const estimatedCost = estimateOpenAiChatCostUsd(
      OPENAI_MODEL_JSON,
      promptTokens,
      completionTokens,
    );

    let rawData: Record<string, unknown>;
    try {
      rawData = JSON.parse(content);
    } catch {
      throw new Error("OpenAI returned invalid JSON");
    }

    const rawRecipes = Array.isArray(rawData.recipes) ? rawData.recipes : [];
    if (rawRecipes.length === 0) throw new Error("No recipes in AI response");

    const pantryRows = user.inventory.map((inv) => ({
      id: inv.ingredient.id,
      name: inv.ingredient.name,
    }));
    const pantryExactMap = buildPantryExactMap(pantryRows);
    const pantryFuse = createPantryFuse(pantryRows);

    const pantrySnapshot = user.inventory.map((inv) => inv.ingredientId);
    const source = (TRIGGER_TO_SOURCE[trigger] ?? "AI_BATCH") as RecipeSource;

    const isMesh = trigger === "NETWORK_MESH";
    const isBridge =
      trigger === "PANTRY_BRIDGE" && bridgePairs && bridgePairs.length > 0;
    const remainingBridgePairs = isBridge
      ? bridgePairs!.map((p) => {
          const [ingredientIdA, ingredientIdB] = sortIngredientPairIds(
            p.ingredientIdA,
            p.ingredientIdB,
          );
          return { ...p, ingredientIdA, ingredientIdB };
        })
      : null;

    const pantryIdToName = new Map(
      user.inventory.map((inv) => [inv.ingredient.id, inv.ingredient.name]),
    );
    const pantryCategoryById = new Map(
      user.inventory.map((inv) => [
        inv.ingredient.id,
        inv.ingredient.category,
      ]),
    );
    const hubNameSet = new Set(networkHubIngredientNames ?? []);

    const createdRecipes: Awaited<ReturnType<typeof prisma.recipe.create>>[] =
      [];

    for (const raw of rawRecipes) {
      const result = generatedRecipeSchema.safeParse(raw);
      if (!result.success) {
        console.warn(`[recipe-gen] Schema validation failed for "${raw?.title ?? "unknown"}":`, result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
        continue;
      }

      const recipe = result.data;
      const cuisineEnum = toCuisine(recipe.cuisine);
      const ingredientNames = recipe.ingredients.map((i) => i.ingredientName);

      const dupCheck = await isDuplicate(
        recipe.title,
        ingredientNames,
        cuisineEnum,
        userId,
      );
      if (dupCheck.isDuplicate) {
        console.warn(`[recipe-gen] Duplicate skipped: "${recipe.title}" — matched existing ${dupCheck.existingRecipeId ?? ""}`);
        continue;
      }

      const matchedIngredients: Array<{
        ingredientId: string;
        quantity: number;
        unit: string;
        isOptional: boolean;
        prepNote: string | null;
        substituteFor: string | null;
      }> = [];

      const seenIngredientIds = new Set<string>();
      let requiredIngredientMiss = false;

      const unmatchedNames: string[] = [];
      for (const gen of recipe.ingredients) {
        const row = matchNameToPantryRow(
          gen.ingredientName,
          pantryExactMap,
          pantryFuse,
          0.35,
        );
        if (!row) {
          if (!gen.isOptional) {
            requiredIngredientMiss = true;
            unmatchedNames.push(gen.ingredientName);
          }
          continue;
        }
        if (seenIngredientIds.has(row.id)) {
          if (!gen.isOptional) {
            requiredIngredientMiss = true;
            unmatchedNames.push(`${gen.ingredientName} (dup→${row.name})`);
          }
          continue;
        }

        seenIngredientIds.add(row.id);
        matchedIngredients.push({
          ingredientId: row.id,
          quantity: gen.quantity,
          unit: gen.unit,
          isOptional: gen.isOptional,
          prepNote: gen.prepNote ?? null,
          substituteFor: gen.substituteFor ?? null,
        });
      }

      if (requiredIngredientMiss) {
        console.warn(`[recipe-gen] Required ingredient miss for "${recipe.title}": ${unmatchedNames.join(", ")}`);
        continue;
      }
      if (matchedIngredients.length === 0) {
        console.warn(`[recipe-gen] No ingredients matched at all for "${recipe.title}"`);
        continue;
      }

      const techniques = dedupe(recipe.techniques.map(toTechnique));

      if (isBridge) {
        if (!remainingBridgePairs?.length) continue;

        const matchedIds = new Set(
          matchedIngredients.map((m) => m.ingredientId),
        );
        const pairIdx = remainingBridgePairs.findIndex(
          (p) =>
            matchedIds.has(p.ingredientIdA) && matchedIds.has(p.ingredientIdB),
        );
        if (pairIdx === -1) continue;

        const minDist = bridgeMinDistinctIngredients ?? 3;
        if (matchedIngredients.length < minDist) continue;

        if (hubNameSet.size >= 2) {
          const hubMatchCount = matchedIngredients.filter((m) =>
            hubNameSet.has(pantryIdToName.get(m.ingredientId) ?? ""),
          ).length;
          if (hubMatchCount < 2) continue;
        }

        const [consumedPair] = remainingBridgePairs.splice(pairIdx, 1);

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
              ownerUserId: userId,
              generationJobId: jobId,
              pantrySnapshotAtGen: pantrySnapshot,
              ingredients: { create: matchedIngredients },
            },
            include: {
              ingredients: { include: { ingredient: true } },
            },
          });
          createdRecipes.push(created);
          try {
            await prisma.pantryBridgeAttempt.create({
              data: {
                userId,
                ingredientAId: consumedPair.ingredientIdA,
                ingredientBId: consumedPair.ingredientIdB,
                generationJobId: jobId,
              },
            });
          } catch {
            // Unique violation — pair already recorded
          }
        } catch {
          remainingBridgePairs.splice(pairIdx, 0, consumedPair);
        }
        continue;
      }

      if (isMesh) {
        if (createdRecipes.length >= count) continue;

        const minDist = bridgeMinDistinctIngredients ?? 5;
        if (matchedIngredients.length < minDist) continue;

        if (hubNameSet.size >= 2) {
          const hubMatchCount = matchedIngredients.filter((m) =>
            hubNameSet.has(pantryIdToName.get(m.ingredientId) ?? ""),
          ).length;
          if (hubMatchCount < 3) continue;
        }

        const categories = new Set(
          matchedIngredients.map(
            (m) => pantryCategoryById.get(m.ingredientId) ?? "",
          ),
        );
        categories.delete("");
        if (categories.size < 3) continue;

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
              ownerUserId: userId,
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
          // Individual mesh recipe failed
        }
        continue;
      }

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
            ownerUserId: userId,
            generationJobId: jobId,
            pantrySnapshotAtGen: pantrySnapshot,
            ingredients: { create: matchedIngredients },
          },
          include: {
            ingredients: { include: { ingredient: true } },
          },
        });
        createdRecipes.push(created);
      } catch (err) {
        console.error(`[recipe-gen] DB create failed for "${recipe.title}":`, err instanceof Error ? err.message : err);
      }
    }

    // Embed newly created recipes (fire-and-forget)
    if (createdRecipes.length > 0) {
      import("@/lib/ai/embedding-service")
        .then(({ embedRecipesBatch }) =>
          embedRecipesBatch(createdRecipes.map((r) => r.id)),
        )
        .catch(() => {});
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

    return {
      jobId,
      recipesGenerated: createdRecipes.length,
      recipes: createdRecipes,
      tokensUsed,
      estimatedCost,
    };
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
    throw error;
  }
}
