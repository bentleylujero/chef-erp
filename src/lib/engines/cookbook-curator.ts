import {
  checkExpiryRescue,
  checkNewIngredientGeneration,
  checkPantryBridgeGeneration,
  checkNetworkMeshGeneration,
  checkPreferenceDriftGeneration,
  checkCookbookBuildGeneration,
  type GenerationDecision,
} from "@/lib/engines/generation-trigger";
import {
  generateRecipeBatch,
  type GenerateBatchParams,
} from "@/lib/engines/recipe-generator";

export interface CurationResult {
  triggered: string | null;
  reason: string;
  decision: GenerationDecision | null;
}

async function fireGeneration(
  userId: string,
  decision: GenerationDecision,
): Promise<void> {
  // COOKBOOK_BUILD uses its own orchestration route — but we still call it
  // via the build route since it needs the wave logic. For other triggers,
  // call the core function directly (no HTTP self-fetch).
  if (decision.trigger === "COOKBOOK_BUILD") {
    // Cookbook build is user-initiated via the build route; curator shouldn't fire it.
    // If it somehow reaches here, just generate a small batch directly.
    await generateRecipeBatch({
      userId,
      trigger: "COOKBOOK_BUILD",
      count: Math.min(decision.count, 25),
    });
    return;
  }

  const params: GenerateBatchParams = {
    userId,
    trigger: decision.trigger,
    count: decision.count,
  };

  if (decision.trigger === "PANTRY_BRIDGE" && decision.context.bridgePairs) {
    params.bridgePairs = decision.context.bridgePairs as GenerateBatchParams["bridgePairs"];
  }

  if (decision.trigger === "NEW_INGREDIENTS" && decision.context.uncoveredIngredientIds) {
    params.focusIngredientIds = decision.context.uncoveredIngredientIds as string[];
  }

  // EXPIRY_RESCUE: pass expiring ingredient names so the AI focuses on them
  if (decision.trigger === "EXPIRY_RESCUE" && decision.context.expiringItems) {
    const items = decision.context.expiringItems as Array<{
      ingredientName: string;
      expiryDate: Date;
    }>;
    params.expiringIngredientNames = items.map((i) => i.ingredientName);
    // Also pass as focus ingredient IDs for coverage checking
    params.focusIngredientIds = (
      decision.context.expiringItems as Array<{ ingredientId: string }>
    ).map((i) => i.ingredientId);
  }

  // PREFERENCE_DRIFT: pass drifted flavor dimensions so the AI adjusts
  if (decision.trigger === "PREFERENCE_DRIFT" && decision.context.driftedDimensions) {
    params.driftedDimensions = (
      decision.context.driftedDimensions as Array<{
        dimension: string;
        userValue: number;
        cookbookAvg: number;
      }>
    ).map((d) => ({
      dimension: d.dimension,
      userValue: d.userValue,
      cookbookAvg: d.cookbookAvg,
    }));
  }

  await generateRecipeBatch(params);
}

/**
 * Evaluates all generation triggers in priority order and fires at most one.
 *
 * Priority: EXPIRY_RESCUE > NEW_INGREDIENTS > PANTRY_BRIDGE > NETWORK_MESH > PREFERENCE_DRIFT
 *
 * This keeps AI usage minimal — only one trigger fires per curation pass,
 * and each trigger has its own cooldown/dedup guards.
 */
export async function curateCookbook(
  userId: string,
  context?: { newIngredientIds?: string[] },
): Promise<CurationResult> {
  const checks: Array<() => Promise<GenerationDecision>> = [
    () => checkExpiryRescue(userId),
    ...(context?.newIngredientIds?.length
      ? [() => checkNewIngredientGeneration(userId, context.newIngredientIds!)]
      : []),
    () => checkPantryBridgeGeneration(userId),
    () => checkNetworkMeshGeneration(userId),
    () => checkPreferenceDriftGeneration(userId),
  ];

  for (const check of checks) {
    const decision = await check();

    if (decision.shouldGenerate) {
      try {
        await fireGeneration(userId, decision);
      } catch {
        return {
          triggered: decision.trigger,
          reason: `${decision.trigger} triggered but generation request failed`,
          decision,
        };
      }

      return {
        triggered: decision.trigger,
        reason: decision.reason,
        decision,
      };
    }
  }

  return {
    triggered: null,
    reason: "No generation triggers applicable at this time",
    decision: null,
  };
}

/**
 * Evaluates whether a full cookbook build is warranted and fires it.
 * Separate from curateCookbook because builds are long-running and user-initiated.
 */
export async function buildCookbook(userId: string): Promise<CurationResult> {
  const decision = await checkCookbookBuildGeneration(userId);

  if (!decision.shouldGenerate) {
    return {
      triggered: null,
      reason: decision.reason,
      decision,
    };
  }

  try {
    await fireGeneration(userId, decision);
  } catch {
    return {
      triggered: decision.trigger,
      reason: `${decision.trigger} triggered but generation request failed`,
      decision,
    };
  }

  return {
    triggered: decision.trigger,
    reason: decision.reason,
    decision,
  };
}
