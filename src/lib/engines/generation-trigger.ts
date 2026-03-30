import { prisma } from "@/lib/prisma";

export interface GenerationDecision {
  shouldGenerate: boolean;
  trigger: string;
  count: number;
  context: Record<string, unknown>;
  reason: string;
}

const NO_OP = (
  trigger: string,
  reason: string,
): GenerationDecision => ({
  shouldGenerate: false,
  trigger,
  count: 0,
  context: {},
  reason,
});

export async function checkOnboardingGeneration(
  userId: string,
): Promise<GenerationDecision> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      inventory: { select: { id: true } },
      cookingStyle: { select: { primaryCuisines: true } },
      generationJobs: {
        where: { trigger: "ONBOARDING_BATCH", status: "COMPLETED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user) return NO_OP("ONBOARDING_BATCH", "User not found");
  if (!user.onboardingComplete)
    return NO_OP("ONBOARDING_BATCH", "Onboarding not yet complete");
  if (user.generationJobs.length > 0)
    return NO_OP("ONBOARDING_BATCH", "Onboarding batch already generated");

  const pantrySize = user.inventory.length;
  if (pantrySize === 0)
    return NO_OP("ONBOARDING_BATCH", "Pantry is empty — nothing to cook with");

  const cuisineCount = user.cookingStyle?.primaryCuisines.length ?? 0;

  let count = 15;
  if (pantrySize > 30) count += 2;
  if (pantrySize > 50) count += 1;
  if (cuisineCount > 2) count += 2;
  count = Math.min(count, 20);

  return {
    shouldGenerate: true,
    trigger: "ONBOARDING_BATCH",
    count,
    context: { pantrySize, cuisineCount },
    reason: `Onboarding complete with ${pantrySize} pantry items across ${cuisineCount} cuisine(s)`,
  };
}

export async function checkNewIngredientGeneration(
  userId: string,
  newIngredientIds: string[],
): Promise<GenerationDecision> {
  if (newIngredientIds.length === 0)
    return NO_OP("NEW_INGREDIENTS", "No new ingredient IDs provided");

  const recipesUsingNew = await prisma.recipeIngredient.findMany({
    where: {
      ingredientId: { in: newIngredientIds },
      recipe: { generationJob: { userId } },
    },
    select: { ingredientId: true },
  });

  const coveredIds = new Set(recipesUsingNew.map((r) => r.ingredientId));
  const uncoveredIds = newIngredientIds.filter((id) => !coveredIds.has(id));

  if (uncoveredIds.length === 0)
    return NO_OP(
      "NEW_INGREDIENTS",
      "All new ingredients already have recipe coverage",
    );

  const count = Math.min(3 + Math.floor(uncoveredIds.length / 2), 5);

  return {
    shouldGenerate: true,
    trigger: "NEW_INGREDIENTS",
    count,
    context: {
      uncoveredIngredientIds: uncoveredIds,
      coveredIngredientIds: [...coveredIds],
      totalNew: newIngredientIds.length,
    },
    reason: `${uncoveredIds.length} of ${newIngredientIds.length} new ingredients lack recipe coverage`,
  };
}

export async function checkExpiryRescue(
  userId: string,
): Promise<GenerationDecision> {
  const now = new Date();
  const twoDaysOut = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const expiringItems = await prisma.inventory.findMany({
    where: {
      userId,
      expiryDate: { gte: now, lte: twoDaysOut },
      quantity: { gt: 0 },
    },
    include: {
      ingredient: { select: { id: true, name: true, category: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  if (expiringItems.length === 0)
    return NO_OP("EXPIRY_RESCUE", "No items expiring within 2 days");

  const count = expiringItems.length >= 3 ? 2 : 1;

  return {
    shouldGenerate: true,
    trigger: "EXPIRY_RESCUE",
    count,
    context: {
      expiringItems: expiringItems.map((item) => ({
        ingredientId: item.ingredient.id,
        ingredientName: item.ingredient.name,
        category: item.ingredient.category,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        unit: item.unit,
      })),
    },
    reason: `${expiringItems.length} item(s) expiring within 2 days`,
  };
}
