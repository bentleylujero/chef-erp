import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUserId } from "@/lib/auth/api-user";
import { generateRecipeBatch } from "@/lib/engines/recipe-generator";

/**
 * POST /api/cookbook/build
 *
 * Orchestrates mass cookbook generation in waves of 20 recipes.
 * Distributes recipes across user's primary + exploring cuisines.
 * Enforces the 90/10 rule: 90% pantry-only, 10% with substitutes.
 *
 * Body:
 *   targetRecipeCount?: number  (default 200, max 500)
 *   waveBatchSize?: number      (default 20, max 25)
 */

const WAVE_SIZE = 20;
const DEFAULT_TARGET = 300;
const MAX_TARGET = 500;
const MAX_WAVES = 25; // safety cap to prevent runaway

export async function POST(request: NextRequest) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  const body = await request.json().catch(() => ({}));
  const targetRecipeCount = Math.min(
    Math.max(body.targetRecipeCount ?? DEFAULT_TARGET, 20),
    MAX_TARGET,
  );
  const waveBatchSize = Math.min(
    Math.max(body.waveBatchSize ?? WAVE_SIZE, 5),
    25,
  );

  // Fetch user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      cookingStyle: true,
      inventory: {
        where: { quantity: { gt: 0 } },
        select: { id: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.inventory.length === 0) {
    return NextResponse.json(
      { error: "Pantry is empty — add ingredients before building a cookbook" },
      { status: 400 },
    );
  }

  // Build cuisine whitelist from user's preferences
  const primaryCuisines = (user.cookingStyle?.primaryCuisines as string[]) ?? [];
  const exploringCuisines = (user.cookingStyle?.exploringCuisines as string[]) ?? [];

  if (primaryCuisines.length === 0 && exploringCuisines.length === 0) {
    return NextResponse.json(
      {
        error:
          "No cuisines selected — set primary or exploring cuisines in your profile first",
      },
      { status: 400 },
    );
  }

  // All available cuisines for discovery rotation
  const ALL_CUISINES = [
    "FRENCH", "ITALIAN", "DELI", "MEXICAN", "MEDITERRANEAN",
    "JAPANESE", "THAI", "KOREAN", "CHINESE", "INDIAN",
    "AMERICAN", "MIDDLE_EASTERN", "AFRICAN", "CARIBBEAN",
    "SOUTHEAST_ASIAN", "FUSION",
  ];

  const preferredSet = new Set([...primaryCuisines, ...exploringCuisines]);
  const discoveryCuisines = ALL_CUISINES.filter((c) => !preferredSet.has(c));

  // Distribution: ~60% primary, ~20% exploring, ~20% discovery
  // Primary cuisines get 3x weight, exploring get 1.5x, discovery get 0.5x each
  const cuisineWeights: Array<{ cuisine: string; weight: number }> = [];
  for (const c of primaryCuisines) {
    cuisineWeights.push({ cuisine: c, weight: 3 });
  }
  for (const c of exploringCuisines) {
    if (!primaryCuisines.includes(c)) {
      cuisineWeights.push({ cuisine: c, weight: 1.5 });
    }
  }
  // Add discovery cuisines — spread the remaining weight across them
  // Pick up to 6 discovery cuisines (rotated randomly) so the cookbook isn't overwhelming
  const shuffled = discoveryCuisines.sort(() => Math.random() - 0.5);
  const discoveryPicks = shuffled.slice(0, Math.min(6, shuffled.length));
  for (const c of discoveryPicks) {
    cuisineWeights.push({ cuisine: c, weight: 0.5 });
  }

  const allCuisines = cuisineWeights.map((cw) => cw.cuisine);
  const totalWeight = cuisineWeights.reduce((s, cw) => s + cw.weight, 0);

  // Distribute target count across cuisines proportionally
  const cuisineTargets: Array<{ cuisine: string; count: number }> = [];
  let distributed = 0;
  for (let i = 0; i < cuisineWeights.length; i++) {
    const cw = cuisineWeights[i];
    const share =
      i === cuisineWeights.length - 1
        ? targetRecipeCount - distributed
        : Math.round((cw.weight / totalWeight) * targetRecipeCount);
    cuisineTargets.push({ cuisine: cw.cuisine, count: share });
    distributed += share;
  }

  // Plan waves: break each cuisine target into batches of waveBatchSize
  const waves: Array<{ cuisine: string; count: number; waveIndex: number }> =
    [];
  let waveIndex = 0;
  for (const ct of cuisineTargets) {
    let remaining = ct.count;
    while (remaining > 0 && waveIndex < MAX_WAVES) {
      const batchCount = Math.min(remaining, waveBatchSize);
      waves.push({ cuisine: ct.cuisine, count: batchCount, waveIndex });
      remaining -= batchCount;
      waveIndex++;
    }
  }

  // Interleave waves across cuisines for variety
  waves.sort((a, b) => a.waveIndex - b.waveIndex);

  // Execute waves sequentially (each depends on previous titles for dedup)
  const results: Array<{
    wave: number;
    cuisine: string;
    recipesGenerated: number;
    tokensUsed: number;
    estimatedCost: number;
    error?: string;
  }> = [];

  let totalGenerated = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (let i = 0; i < waves.length; i++) {
    const wave = waves[i];

    try {
      const data = await generateRecipeBatch({
        userId,
        trigger: "COOKBOOK_BUILD",
        targetCuisine: wave.cuisine,
        count: wave.count,
        allowedCuisines: allCuisines,
      });

      const generated = data.recipesGenerated ?? 0;
      const tokens = data.tokensUsed ?? 0;
      const cost = data.estimatedCost ?? 0;

      totalGenerated += generated;
      totalTokens += tokens;
      totalCost += cost;

      results.push({
        wave: i,
        cuisine: wave.cuisine,
        recipesGenerated: generated,
        tokensUsed: tokens,
        estimatedCost: cost,
      });
    } catch (error) {
      results.push({
        wave: i,
        cuisine: wave.cuisine,
        recipesGenerated: 0,
        tokensUsed: 0,
        estimatedCost: 0,
        error: error instanceof Error ? error.message : "Wave failed",
      });
    }
  }

  return NextResponse.json({
    target: targetRecipeCount,
    wavesPlanned: waves.length,
    wavesCompleted: results.filter((r) => !r.error).length,
    totalRecipesGenerated: totalGenerated,
    totalTokensUsed: totalTokens,
    totalEstimatedCost: totalCost,
    cuisineDistribution: cuisineTargets,
    waves: results,
  });
}
