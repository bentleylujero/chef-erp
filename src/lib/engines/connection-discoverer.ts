import { prisma } from "@/lib/prisma";
import { cosineSimilarity } from "@/lib/utils/scoring";
import { categoryBridgeScore } from "@/lib/engines/pantry-bridge-heuristics";
import type { IngredientCategory } from "@prisma/client";

export interface IngredientConnection {
  targetId: string;
  targetName: string;
  flavorAffinity: number;
  sharedCuisines: string[];
  categoryScore: number;
  totalScore: number;
}

export interface ConnectionReport {
  ingredientId: string;
  ingredientName: string;
  connections: IngredientConnection[];
}

function parseFlavorTags(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number") result[k] = v;
  }
  return result;
}

/**
 * Deterministic (zero-AI) connection discovery for a newly enriched ingredient.
 * Finds the top-N most compatible existing ingredients by combining:
 *   - Flavor affinity (cosine similarity of flavorTags) — 50% weight
 *   - Cuisine overlap (Jaccard of cuisineTags) — 30% weight
 *   - Category compatibility (bridge score) — 20% weight
 */
export async function discoverConnections(
  ingredientId: string,
  limit = 20,
): Promise<ConnectionReport> {
  const source = await prisma.ingredient.findUniqueOrThrow({
    where: { id: ingredientId },
    select: {
      id: true,
      name: true,
      category: true,
      flavorTags: true,
      cuisineTags: true,
    },
  });

  const sourceFlavor = parseFlavorTags(source.flavorTags);
  const sourceCuisines = new Set<string>(source.cuisineTags);

  // Exclude self and ubiquitous seasonings from candidates
  const candidates = await prisma.ingredient.findMany({
    where: {
      id: { not: ingredientId },
      NOT: { flavorTags: { equals: {} } },
    },
    select: {
      id: true,
      name: true,
      category: true,
      flavorTags: true,
      cuisineTags: true,
    },
  });

  const scored: IngredientConnection[] = [];

  for (const candidate of candidates) {
    const candidateFlavor = parseFlavorTags(candidate.flavorTags);
    const candidateCuisines = new Set<string>(candidate.cuisineTags);

    // Flavor affinity: cosine similarity (0-1)
    const flavorAffinity = cosineSimilarity(sourceFlavor, candidateFlavor);

    // Cuisine overlap: Jaccard index (0-1)
    let cuisineOverlap = 0;
    if (sourceCuisines.size > 0 || candidateCuisines.size > 0) {
      let intersection = 0;
      for (const c of sourceCuisines) {
        if (candidateCuisines.has(c)) intersection++;
      }
      const union = sourceCuisines.size + candidateCuisines.size - intersection;
      cuisineOverlap = union > 0 ? intersection / union : 0;
    }

    const sharedCuisines = [...sourceCuisines].filter((c) =>
      candidateCuisines.has(c),
    );

    // Category compatibility: normalized to 0-1
    const rawBridge = categoryBridgeScore(
      source.category as IngredientCategory,
      candidate.category as IngredientCategory,
    );
    const categoryScore = Math.max(0, rawBridge) / 8; // max bridge score is 8

    const totalScore =
      flavorAffinity * 0.5 + cuisineOverlap * 0.3 + categoryScore * 0.2;

    scored.push({
      targetId: candidate.id,
      targetName: candidate.name,
      flavorAffinity: Math.round(flavorAffinity * 1000) / 1000,
      sharedCuisines,
      categoryScore: Math.round(categoryScore * 1000) / 1000,
      totalScore: Math.round(totalScore * 1000) / 1000,
    });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);

  return {
    ingredientId: source.id,
    ingredientName: source.name,
    connections: scored.slice(0, limit),
  };
}
