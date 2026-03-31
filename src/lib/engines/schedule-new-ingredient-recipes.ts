import { after } from "next/server";
import {
  checkNewIngredientGeneration,
  checkPantryBridgeGeneration,
} from "@/lib/engines/generation-trigger";

function appOrigin(): string {
  const explicit = process.env.INTERNAL_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000";
}

/**
 * After pantry gains new ingredient lines, optionally run NEW_INGREDIENTS batch generation.
 * Uses `after()` so the HTTP response returns immediately; generation runs in the background.
 */
export function scheduleNewIngredientRecipeGeneration(
  userId: string,
  newToPantryIngredientIds: string[],
): void {
  const unique = [...new Set(newToPantryIngredientIds.filter(Boolean))];
  if (unique.length === 0) return;

  after(async () => {
    try {
      const decision = await checkNewIngredientGeneration(userId, unique);
      if (decision.shouldGenerate) {
        await fetch(`${appOrigin()}/api/ai/generate-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            trigger: decision.trigger,
            count: decision.count,
            focusIngredientIds:
              decision.context.uncoveredIngredientIds ?? unique,
          }),
        });
      }

      // After new-ingredient recipes may land, bridge remaining unlinked pairs (each pair AI’d once).
      const bridge = await checkPantryBridgeGeneration(userId);
      if (bridge.shouldGenerate) {
        await fetch(`${appOrigin()}/api/ai/generate-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            trigger: bridge.trigger,
            count: bridge.count,
            bridgePairs: bridge.context.bridgePairs,
          }),
        });
      }
    } catch {
      // Fire-and-forget; failures are visible in GenerationJob / logs
    }
  });
}
