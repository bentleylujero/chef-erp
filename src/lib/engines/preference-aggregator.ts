import { prisma } from "@/lib/prisma";
import type { Cuisine } from "@prisma/client";

const FLAVOR_KEYS = [
  "spiceTolerance",
  "sweetPref",
  "saltyPref",
  "sourPref",
  "umamiPref",
  "bitterPref",
] as const;

const FLAVOR_TAG_MAP: Record<string, (typeof FLAVOR_KEYS)[number]> = {
  spicy: "spiceTolerance",
  sweet: "sweetPref",
  salty: "saltyPref",
  sour: "sourPref",
  acidic: "sourPref",
  umami: "umamiPref",
  bitter: "bitterPref",
  rich: "umamiPref",
};

function exponentialDecayWeight(index: number, lambda = 0.05): number {
  return Math.exp(-lambda * index);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function updateFlavorProfileFromSignals(
  userId: string,
): Promise<void> {
  const signals = await prisma.preferenceSignal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (signals.length === 0) return;

  const flavorDeltas: Record<(typeof FLAVOR_KEYS)[number], number[]> = {
    spiceTolerance: [],
    sweetPref: [],
    saltyPref: [],
    sourPref: [],
    umamiPref: [],
    bitterPref: [],
  };

  const cuisineCounts: Record<string, number> = {};
  const exploringCuisines = new Set<string>();

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const weight = exponentialDecayWeight(i);
    const metadata = signal.metadata as Record<string, unknown>;

    if (
      signal.signalType === "RATED" &&
      signal.entityType === "RECIPE"
    ) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: signal.entityId },
        select: { flavorTags: true, cuisine: true },
      });

      if (recipe) {
        const rating = (metadata.rating as number) ?? 3;
        const ratingBias = (rating - 3) / 2;
        const tags = recipe.flavorTags as Record<string, number>;

        for (const [tag, value] of Object.entries(tags)) {
          const profileKey = FLAVOR_TAG_MAP[tag];
          if (profileKey && typeof value === "number") {
            flavorDeltas[profileKey].push(value * ratingBias * weight);
          }
        }
      }
    }

    if (
      signal.signalType === "COOKED" &&
      signal.entityType === "RECIPE"
    ) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: signal.entityId },
        select: { cuisine: true },
      });

      if (recipe) {
        const cuisine = recipe.cuisine;
        cuisineCounts[cuisine] =
          (cuisineCounts[cuisine] ?? 0) + weight;
      }
    }

    if (
      signal.signalType === "PURCHASED" &&
      signal.entityType === "INGREDIENT"
    ) {
      const ingredient = await prisma.ingredient.findUnique({
        where: { id: signal.entityId },
        select: { cuisineTags: true },
      });

      if (ingredient) {
        for (const tag of ingredient.cuisineTags) {
          exploringCuisines.add(tag);
        }
      }
    }
  }

  const currentProfile = await prisma.flavorProfile.findUnique({
    where: { userId },
  });

  const profileUpdate: Record<string, number> = {};
  for (const key of FLAVOR_KEYS) {
    const deltas = flavorDeltas[key];
    if (deltas.length > 0) {
      const avgDelta =
        deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
      const currentValue = currentProfile
        ? (currentProfile[key] as number)
        : 5;
      profileUpdate[key] = clamp(
        Math.round(currentValue + avgDelta),
        1,
        10,
      );
    }
  }

  if (Object.keys(profileUpdate).length > 0) {
    await prisma.flavorProfile.upsert({
      where: { userId },
      update: profileUpdate,
      create: { userId, ...profileUpdate },
    });
  }

  const sortedCuisines = Object.entries(cuisineCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([c]) => c as Cuisine);

  const primaryCuisines = sortedCuisines.slice(0, 3);
  const currentStyle = await prisma.cookingStyle.findUnique({
    where: { userId },
    select: { exploringCuisines: true, primaryCuisines: true },
  });

  const existingPrimary = currentStyle?.primaryCuisines ?? [];
  const existingExploring = currentStyle?.exploringCuisines ?? [];

  const mergedExploring = [
    ...new Set([
      ...existingExploring,
      ...Array.from(exploringCuisines) as Cuisine[],
    ]),
  ].filter((c) => !primaryCuisines.includes(c));

  if (primaryCuisines.length > 0 || mergedExploring.length > 0) {
    await prisma.cookingStyle.upsert({
      where: { userId },
      update: {
        ...(primaryCuisines.length > 0
          ? {
              primaryCuisines:
                primaryCuisines.length > 0
                  ? primaryCuisines
                  : existingPrimary,
            }
          : {}),
        exploringCuisines: mergedExploring,
      },
      create: {
        userId,
        primaryCuisines:
          primaryCuisines.length > 0 ? primaryCuisines : existingPrimary,
        exploringCuisines: mergedExploring,
      },
    });
  }
}
