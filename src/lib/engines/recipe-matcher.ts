import { prisma } from "@/lib/prisma";
import { recipeVisibilityClause } from "@/lib/recipes/visibility";
import { cosineSimilarity, weightedScore } from "@/lib/utils/scoring";
import { addDays } from "date-fns";
import type { Technique } from "@prisma/client";

export interface MatchScore {
  recipeId: string;
  title: string;
  description: string;
  cuisine: string;
  difficulty: number;
  techniques: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  tags: string[];
  source: string;
  totalCooks: number;
  avgRating: number | null;
  createdAt: Date;
  pantryOverlap: number;
  flavorMatch: number;
  cuisineAffinity: number;
  techniqueComfort: number;
  expiryBonus: number;
  total: number;
  _count: { ingredients: number; ratings: number };
}

export interface MatchContext {
  userId: string;
  targetCuisine?: string;
  maxDifficulty?: number;
  maxTime?: number;
  limit?: number;
  /** Minimum pantry overlap percentage (0–100). Recipes below this are excluded. Default: 80 */
  minPantryOverlap?: number;
}

const COMFORT_MAP: Record<number, number> = {
  5: 100,
  4: 80,
  3: 60,
  2: 40,
  1: 20,
};
const UNKNOWN_TECHNIQUE_SCORE = 40;

const FLAVOR_PROFILE_KEYS: Record<string, string> = {
  spiceTolerance: "spicy",
  sweetPref: "sweet",
  saltyPref: "salty",
  sourPref: "sour",
  umamiPref: "umami",
  bitterPref: "bitter",
};

export async function matchRecipes(
  context: MatchContext,
): Promise<MatchScore[]> {
  const { userId, targetCuisine, maxDifficulty, maxTime, limit = 50, minPantryOverlap = 80 } = context;

  const [user, recipes] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        inventory: { select: { ingredientId: true, expiryDate: true } },
        flavorProfile: true,
        cookingStyle: true,
        techniqueLogs: true,
      },
    }),
    prisma.recipe.findMany({
      where: { status: "active", AND: [recipeVisibilityClause(userId)] },
      include: {
        ingredients: { select: { ingredientId: true, isOptional: true } },
        _count: { select: { ratings: true } },
      },
    }),
  ]);

  const pantryIds = new Set(user.inventory.map((i) => i.ingredientId));
  const threeDaysOut = addDays(new Date(), 3);
  const expiringIds = new Set(
    user.inventory
      .filter((i) => i.expiryDate && i.expiryDate <= threeDaysOut && i.expiryDate >= new Date())
      .map((i) => i.ingredientId),
  );

  const userFlavorVec: Record<string, number> = {};
  if (user.flavorProfile) {
    for (const [dbKey, vecKey] of Object.entries(FLAVOR_PROFILE_KEYS)) {
      userFlavorVec[vecKey] =
        (user.flavorProfile as unknown as Record<string, number>)[dbKey] ?? 5;
    }
  }

  const primaryCuisines = new Set<string>(user.cookingStyle?.primaryCuisines ?? []);
  const exploringCuisines = new Set<string>(user.cookingStyle?.exploringCuisines ?? []);

  const techniqueMap = new Map<Technique, number>();
  for (const log of user.techniqueLogs) {
    techniqueMap.set(log.technique, log.comfortLevel);
  }

  const scored: MatchScore[] = [];

  for (const recipe of recipes) {
    if (targetCuisine && recipe.cuisine !== targetCuisine) continue;
    if (maxDifficulty && recipe.difficulty > maxDifficulty) continue;
    if (maxTime && recipe.prepTime + recipe.cookTime > maxTime) continue;

    const requiredIngredients = recipe.ingredients.filter((ri) => !ri.isOptional);
    const totalRequired = requiredIngredients.length;
    const matchedCount = requiredIngredients.filter((ri) =>
      pantryIds.has(ri.ingredientId),
    ).length;
    const pantryOverlap = totalRequired > 0 ? (matchedCount / totalRequired) * 100 : 100;

    // Skip recipes that fall below the minimum pantry overlap threshold
    if (pantryOverlap < minPantryOverlap) continue;

    const recipeFlavorVec = (recipe.flavorTags ?? {}) as Record<string, number>;
    const flavorMatch =
      Object.keys(userFlavorVec).length > 0
        ? cosineSimilarity(userFlavorVec, recipeFlavorVec) * 100
        : 50;

    let cuisineAffinity: number;
    if (primaryCuisines.has(recipe.cuisine)) {
      cuisineAffinity = 100;
    } else if (exploringCuisines.has(recipe.cuisine)) {
      cuisineAffinity = 75;
    } else {
      cuisineAffinity = 35;
    }

    let techniqueComfort: number;
    if (recipe.techniques.length > 0) {
      const comfortValues = recipe.techniques.map((t) => {
        const level = techniqueMap.get(t);
        return level !== undefined ? (COMFORT_MAP[level] ?? UNKNOWN_TECHNIQUE_SCORE) : UNKNOWN_TECHNIQUE_SCORE;
      });
      techniqueComfort = comfortValues.reduce((a, b) => a + b, 0) / comfortValues.length;
    } else {
      techniqueComfort = 50;
    }

    let expiryBonus = 0;
    for (const ri of recipe.ingredients) {
      if (expiringIds.has(ri.ingredientId)) {
        expiryBonus += 5;
        if (expiryBonus >= 20) {
          expiryBonus = 20;
          break;
        }
      }
    }

    const total = weightedScore([
      { value: pantryOverlap, weight: 25 },
      { value: flavorMatch, weight: 15 },
      { value: cuisineAffinity, weight: 30 },
      { value: techniqueComfort, weight: 15 },
      { value: expiryBonus, weight: 15 },
    ]);

    scored.push({
      recipeId: recipe.id,
      title: recipe.title,
      description: recipe.description,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      techniques: recipe.techniques as string[],
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      tags: recipe.tags,
      source: recipe.source,
      totalCooks: recipe.totalCooks,
      avgRating: recipe.avgRating ? Number(recipe.avgRating) : null,
      createdAt: recipe.createdAt,
      pantryOverlap: Math.round(pantryOverlap * 100) / 100,
      flavorMatch: Math.round(flavorMatch * 100) / 100,
      cuisineAffinity,
      techniqueComfort: Math.round(techniqueComfort * 100) / 100,
      expiryBonus,
      total: Math.round(total * 100) / 100,
      _count: { ingredients: recipe.ingredients.length, ratings: recipe._count.ratings },
    });
  }

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, limit);
}
