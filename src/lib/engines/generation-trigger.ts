import { prisma } from "@/lib/prisma";
import {
  getPantryNetworkHubIngredientNames,
  getUnlinkedPantryIngredients,
} from "@/lib/engines/topology-builder";
import {
  pickBridgePairsForGeneration,
  rankPantryBridgePairs,
} from "@/lib/engines/pantry-bridge-heuristics";

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
  _userId: string,
  newIngredientIds: string[],
): Promise<GenerationDecision> {
  void _userId;
  if (newIngredientIds.length === 0)
    return NO_OP("NEW_INGREDIENTS", "No new ingredient IDs provided");

  // Any active recipe in the catalog counts as coverage (shared cookbook, not only AI jobs).
  const recipesUsingNew = await prisma.recipeIngredient.findMany({
    where: {
      ingredientId: { in: newIngredientIds },
      recipe: { status: "active" },
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

export async function checkPantryBridgeGeneration(
  userId: string,
): Promise<GenerationDecision> {
  const {
    unlinked,
    linkedCorpusPantry,
    totalPantryWithStock,
    linkedPantryCount,
  } = await getUnlinkedPantryIngredients(userId);

  if (unlinked.length === 0) {
    return NO_OP(
      "PANTRY_BRIDGE",
      "No unlinked pantry items — everything already co-occurs in the cookbook",
    );
  }

  const attempts = await prisma.pantryBridgeAttempt.findMany({
    where: { userId },
    select: { ingredientAId: true, ingredientBId: true },
  });
  const attempted = new Set(
    attempts.map((a) => `${a.ingredientAId}::${a.ingredientBId}`),
  );

  const ranked = rankPantryBridgePairs(
    unlinked,
    attempted,
    linkedCorpusPantry,
  );
  const unlinkedIds = new Set(unlinked.map((u) => u.id));
  const chosen = pickBridgePairsForGeneration(ranked, unlinkedIds, 5);

  if (chosen.length === 0) {
    return NO_OP(
      "PANTRY_BRIDGE",
      ranked.length === 0
        ? "No bridgeable pairs (e.g. lone unlinked with no stocked graph neighbor, or only low-compatibility mixes left)"
        : "No new high-likelihood pairs left — these bridges were already sent to AI",
    );
  }

  return {
    shouldGenerate: true,
    trigger: "PANTRY_BRIDGE",
    count: chosen.length,
    context: {
      bridgePairs: chosen,
      unlinkedCount: unlinked.length,
      linkedCorpusPantryCount: linkedCorpusPantry.length,
      totalPantryWithStock,
      linkedPantryCount,
    },
    reason: `Bridging ${chosen.length} novel ingredient pair(s); ${unlinked.length} unlinked pantry item(s)${linkedCorpusPantry.length ? `; attaching to ${linkedCorpusPantry.length} stocked graph ingredient(s)` : ""}`,
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

const MESH_MAX_RECIPES = 3;
const MESH_MIN_PANTRY = 5;
const MESH_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Second pass: OpenAI recipes that densify hub ↔ pantry edges (no prescribed pairs). Capped and cooldown-limited. */
export async function checkNetworkMeshGeneration(
  userId: string,
): Promise<GenerationDecision> {
  const recentMesh = await prisma.generationJob.findFirst({
    where: {
      userId,
      trigger: "NETWORK_MESH",
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  const rows = await prisma.inventory.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: { id: true },
  });
  const pantrySize = rows.length;

  if (
    recentMesh?.completedAt &&
    Date.now() - recentMesh.completedAt.getTime() < MESH_COOLDOWN_MS
  ) {
    return {
      shouldGenerate: false,
      trigger: "NETWORK_MESH",
      count: 0,
      context: { pantrySize, hubCount: 0 },
      reason: "Mesh pass ran recently — try again in a few hours",
    };
  }

  if (rows.length < MESH_MIN_PANTRY) {
    return {
      shouldGenerate: false,
      trigger: "NETWORK_MESH",
      count: 0,
      context: { pantrySize: rows.length, hubCount: 0 },
      reason: `Need at least ${MESH_MIN_PANTRY} stocked items for a mesh pass`,
    };
  }

  const hubs = await getPantryNetworkHubIngredientNames(userId, 28);
  if (hubs.length < 2) {
    return {
      shouldGenerate: false,
      trigger: "NETWORK_MESH",
      count: 0,
      context: { pantrySize: rows.length, hubCount: hubs.length },
      reason:
        "Cookbook graph is still thin — add recipes (e.g. pantry bridge) first",
    };
  }

  const count = Math.min(
    MESH_MAX_RECIPES,
    Math.max(1, Math.floor(rows.length / 4)),
  );

  return {
    shouldGenerate: true,
    trigger: "NETWORK_MESH",
    count,
    context: {
      hubCount: hubs.length,
      pantrySize,
    },
    reason: `Network mesh: ${count} recipe(s) max to weave graph hubs through pantry`,
  };
}
