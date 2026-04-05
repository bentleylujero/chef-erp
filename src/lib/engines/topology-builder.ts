import { prisma } from "@/lib/prisma";
import { recipeVisibilityClause } from "@/lib/recipes/visibility";
import type { Cuisine, IngredientCategory } from "@prisma/client";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TopologyNode {
  id: string;
  name: string;
  category: string;
  recipeCount: number;
  /** Sum of co-occurrence weights on incident edges (total synergy reach). */
  synergyStrength: number;
  inPantry: boolean;
  cuisineTags: string[];
  /** Flavor dimension scores from the ingredient record (e.g. { spicy: 3, sweet: 1, umami: 8 }). */
  flavorTags: Record<string, number>;
  /** How many times the user has cooked recipes containing this ingredient. */
  cookCount: number;
  /** Average rating of recipes containing this ingredient (null if unrated). */
  avgRating: number | null;
  /** ISO date of the user's most recent cook of a recipe containing this ingredient. */
  lastCooked: string | null;
  /** Distinct substituteGroup values from RecipeIngredient rows referencing this ingredient. */
  substituteGroupIds: string[];
}

export interface TopologyRecipeRef {
  id: string;
  title: string;
  cuisine: string;
  difficulty: number;
  cookTime: number;
}

export interface TopologyLink {
  source: string;
  target: string;
  weight: number;
  recipes: TopologyRecipeRef[];
  /** Present when the edge exists only to join disconnected graph components. */
  synthetic?: boolean;
  /** Cosine similarity of ingredient flavorTags (0-1). */
  flavorAffinity: number;
  /** Intersection of both ingredients' cuisineTags. */
  sharedCuisines: string[];
  /** True if both ingredients share a substituteGroup in any recipe. */
  substituteLink: boolean;
}

export interface TopologyRecipeSummary {
  id: string;
  title: string;
  cuisine: string;
  ingredientIds: string[];
  pantryMatch: number;
  missingIngredients: { id: string; name: string }[];
}

export interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
  stats: {
    totalIngredients: number;
    totalConnections: number;
    avgConnectionsPerNode: number;
    strongestConnection: {
      source: string;
      target: string;
      weight: number;
    } | null;
  };
  meta: {
    maxCookCount: number;
    maxFlavorAffinity: number;
    categoryClusterCentroids: Record<string, { count: number }>;
  };
  recipes: TopologyRecipeSummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function connectedComponents(
  nodeIds: readonly string[],
  links: readonly TopologyLink[],
): string[][] {
  const idSet = new Set(nodeIds);
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const l of links) {
    if (!idSet.has(l.source) || !idSet.has(l.target)) continue;
    adj.get(l.source)!.push(l.target);
    adj.get(l.target)!.push(l.source);
  }
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of nodeIds) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(u);
      for (const v of adj.get(u) ?? []) {
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

function pickRepresentativeNodeId(
  component: string[],
  synergyById: Map<string, number>,
): string {
  let best = component[0]!;
  let bestS = synergyById.get(best) ?? 0;
  for (let i = 1; i < component.length; i++) {
    const id = component[i]!;
    const s = synergyById.get(id) ?? 0;
    if (s > bestS || (s === bestS && id.localeCompare(best) < 0)) {
      best = id;
      bestS = s;
    }
  }
  return best;
}

/**
 * Adds minimal edges so every node lies in one connected component (force layout + hover graph).
 * Bridges attach satellite components to a hub in the largest co-occurrence cluster.
 */
function addSyntheticBridgeLinks(
  nodes: TopologyNode[],
  links: TopologyLink[],
  synergyById: Map<string, number>,
): TopologyLink[] {
  if (nodes.length < 2) return links;

  const nodeIds = nodes.map((n) => n.id);
  const components = connectedComponents(nodeIds, links);
  if (components.length <= 1) return links;

  components.sort((a, b) => {
    const d = b.length - a.length;
    if (d !== 0) return d;
    return a[0]!.localeCompare(b[0]!);
  });

  const hubId = pickRepresentativeNodeId(components[0]!, synergyById);
  const existingPairs = new Set<string>();
  for (const l of links) {
    existingPairs.add(pairKey(l.source, l.target));
  }

  const extra: TopologyLink[] = [];
  for (let i = 1; i < components.length; i++) {
    const repId = pickRepresentativeNodeId(components[i]!, synergyById);
    const pk = pairKey(hubId, repId);
    if (existingPairs.has(pk)) continue;
    existingPairs.add(pk);
    const [source, target] =
      hubId < repId ? [hubId, repId] : [repId, hubId];
    extra.push({
      source,
      target,
      weight: 0,
      recipes: [],
      synthetic: true,
      flavorAffinity: 0,
      sharedCuisines: [],
      substituteLink: false,
    });
  }

  return [...links, ...extra];
}

/** Ubiquitous seasonings that obscure co-occurrence structure (not bell pepper / pepper flakes). */
function isTopologyExcludedIngredient(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (n.includes("unsalted")) return false;

  if (n.includes("black pepper") || n.includes("white pepper")) return true;
  if (n === "pepper") return true;

  if (n.includes("fleur de sel")) return true;
  if (n === "salt" || n.endsWith(" salt") || /\bsalt\s*\(/.test(n)) return true;

  return false;
}

/** Cosine similarity between two sparse flavor-tag vectors. Returns 0-1. */
function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Safely cast a Prisma Json field to Record<string, number>. */
function parseFlavorTags(raw: unknown): Record<string, number> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, number>;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildTopologyData(
  userId: string,
  filters?: {
    cuisine?: string;
    pantryOnly?: boolean;
    minWeight?: number;
    mode?: string; // "co-occurrence" | "flavor-affinity" | "cuisine-clusters"
  },
): Promise<TopologyData> {
  const recipeWhere: Record<string, unknown> = {
    status: "active",
    AND: [recipeVisibilityClause(userId)],
  };
  if (filters?.cuisine) {
    recipeWhere.cuisine = filters.cuisine as Cuisine;
  }

  // ── Parallel data fetches ────────────────────────────
  const [recipes, pantryRows, cookingLogs, recipeRatings, substituteRows] =
    await Promise.all([
      prisma.recipe.findMany({
        where: recipeWhere,
        select: {
          id: true,
          title: true,
          cuisine: true,
          difficulty: true,
          cookTime: true,
          ingredients: {
            select: {
              substituteGroup: true,
              ingredient: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  cuisineTags: true,
                  flavorTags: true,
                },
              },
            },
          },
        },
      }),
      prisma.inventory.findMany({
        where: { userId },
        select: { ingredientId: true },
      }),
      prisma.cookingLog.findMany({
        where: { userId },
        select: { recipeId: true, cookedAt: true },
      }),
      prisma.recipeRating.findMany({
        where: { userId },
        select: { recipeId: true, rating: true },
      }),
      prisma.recipeIngredient.findMany({
        where: { substituteGroup: { not: null } },
        select: { ingredientId: true, substituteGroup: true },
      }),
    ]);

  const pantryIngredientIds = new Set(pantryRows.map((inv) => inv.ingredientId));

  // ── Build cook stats per recipe, then per ingredient ─
  const recipeCookCounts = new Map<string, { count: number; lastCooked: Date }>();
  for (const log of cookingLogs) {
    const entry = recipeCookCounts.get(log.recipeId);
    if (!entry) {
      recipeCookCounts.set(log.recipeId, { count: 1, lastCooked: log.cookedAt });
    } else {
      entry.count++;
      if (log.cookedAt > entry.lastCooked) entry.lastCooked = log.cookedAt;
    }
  }

  const recipeRatingMap = new Map<string, { sum: number; count: number }>();
  for (const r of recipeRatings) {
    const entry = recipeRatingMap.get(r.recipeId);
    if (!entry) {
      recipeRatingMap.set(r.recipeId, { sum: r.rating, count: 1 });
    } else {
      entry.sum += r.rating;
      entry.count++;
    }
  }

  // ── Build substitute group map: substituteGroup -> ingredientId[] ─
  const substituteGroupMap = new Map<string, Set<string>>();
  for (const row of substituteRows) {
    if (!row.substituteGroup) continue;
    let set = substituteGroupMap.get(row.substituteGroup);
    if (!set) {
      set = new Set();
      substituteGroupMap.set(row.substituteGroup, set);
    }
    set.add(row.ingredientId);
  }

  // ── Build substitute pairs set for quick lookup ──────
  const substitutePairs = new Set<string>();
  for (const [, members] of substituteGroupMap) {
    const ids = [...members];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        substitutePairs.add(pairKey(ids[i], ids[j]));
      }
    }
  }

  // ── Per-ingredient substitute groups ─────────────────
  const ingredientSubstituteGroups = new Map<string, Set<string>>();
  for (const row of substituteRows) {
    if (!row.substituteGroup) continue;
    let set = ingredientSubstituteGroups.get(row.ingredientId);
    if (!set) {
      set = new Set();
      ingredientSubstituteGroups.set(row.ingredientId, set);
    }
    set.add(row.substituteGroup);
  }

  // ── Ingredient map + co-occurrence ───────────────────
  const ingredientMap = new Map<
    string,
    {
      name: string;
      category: IngredientCategory;
      cuisineTags: Cuisine[];
      flavorTags: Record<string, number>;
      recipeIds: Set<string>;
    }
  >();

  const coOccurrences = new Map<
    string,
    { count: number; recipeRefs: TopologyRecipeRef[] }
  >();

  // Also build recipe summaries for "What Can I Cook?"
  const recipeSummaries: TopologyRecipeSummary[] = [];

  for (const recipe of recipes) {
    const ingredientIds: string[] = [];
    const recipeIngIds: string[] = [];
    const missingIngredients: { id: string; name: string }[] = [];

    for (const ri of recipe.ingredients) {
      const ing = ri.ingredient;
      recipeIngIds.push(ing.id);
      if (!pantryIngredientIds.has(ing.id)) {
        missingIngredients.push({ id: ing.id, name: ing.name });
      }

      if (isTopologyExcludedIngredient(ing.name)) continue;

      ingredientIds.push(ing.id);

      let entry = ingredientMap.get(ing.id);
      if (!entry) {
        entry = {
          name: ing.name,
          category: ing.category,
          cuisineTags: ing.cuisineTags,
          flavorTags: parseFlavorTags(ing.flavorTags),
          recipeIds: new Set(),
        };
        ingredientMap.set(ing.id, entry);
      }
      entry.recipeIds.add(recipe.id);
    }

    const recipeRef: TopologyRecipeRef = {
      id: recipe.id,
      title: recipe.title,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      cookTime: recipe.cookTime,
    };

    for (let i = 0; i < ingredientIds.length; i++) {
      for (let j = i + 1; j < ingredientIds.length; j++) {
        const key = pairKey(ingredientIds[i], ingredientIds[j]);
        let pair = coOccurrences.get(key);
        if (!pair) {
          pair = { count: 0, recipeRefs: [] };
          coOccurrences.set(key, pair);
        }
        pair.count++;
        if (pair.recipeRefs.length < 5) {
          pair.recipeRefs.push(recipeRef);
        }
      }
    }

    // Recipe summary
    const totalCount = recipeIngIds.length;
    const pantryCount = recipeIngIds.filter((id) => pantryIngredientIds.has(id)).length;
    recipeSummaries.push({
      id: recipe.id,
      title: recipe.title,
      cuisine: recipe.cuisine,
      ingredientIds: recipeIngIds,
      pantryMatch: totalCount > 0 ? pantryCount / totalCount : 0,
      missingIngredients,
    });
  }

  // Sort recipe summaries by pantry match descending
  recipeSummaries.sort((a, b) => b.pantryMatch - a.pantryMatch);

  // ── Build links ──────────────────────────────────────
  const minWeight = filters?.minWeight ?? 1;
  const connectedIds = new Set<string>();
  const links: TopologyLink[] = [];
  let strongest: TopologyLink | null = null;
  let maxFlavorAffinity = 0;

  for (const [key, pair] of coOccurrences) {
    if (pair.count < minWeight) continue;

    const [sourceId, targetId] = key.split("::");

    if (filters?.pantryOnly) {
      if (!pantryIngredientIds.has(sourceId) || !pantryIngredientIds.has(targetId)) {
        continue;
      }
    }

    const srcEntry = ingredientMap.get(sourceId);
    const tgtEntry = ingredientMap.get(targetId);

    const affinity =
      srcEntry && tgtEntry
        ? cosineSimilarity(srcEntry.flavorTags, tgtEntry.flavorTags)
        : 0;
    if (affinity > maxFlavorAffinity) maxFlavorAffinity = affinity;

    const srcCuisines = new Set(srcEntry?.cuisineTags ?? []);
    const sharedCuisines = (tgtEntry?.cuisineTags ?? []).filter((c) =>
      srcCuisines.has(c),
    );

    const link: TopologyLink = {
      source: sourceId,
      target: targetId,
      weight: pair.count,
      recipes: pair.recipeRefs,
      flavorAffinity: Math.round(affinity * 1000) / 1000,
      sharedCuisines,
      substituteLink: substitutePairs.has(key),
    };

    links.push(link);
    connectedIds.add(sourceId);
    connectedIds.add(targetId);

    if (!strongest || pair.count > strongest.weight) {
      strongest = link;
    }
  }

  // ── Synergy scores ───────────────────────────────────
  const synergyById = new Map<string, number>();
  for (const link of links) {
    synergyById.set(
      link.source,
      (synergyById.get(link.source) ?? 0) + link.weight,
    );
    synergyById.set(
      link.target,
      (synergyById.get(link.target) ?? 0) + link.weight,
    );
  }

  // Include every pantry ingredient as a node
  const nodeIds = new Set<string>(connectedIds);
  for (const id of pantryIngredientIds) {
    nodeIds.add(id);
  }

  // Fetch metadata for pantry-only nodes missing from the recipe-based ingredientMap
  const missingMetaIds = [...nodeIds].filter((id) => !ingredientMap.has(id));
  if (missingMetaIds.length > 0) {
    const extras = await prisma.ingredient.findMany({
      where: { id: { in: missingMetaIds } },
      select: { id: true, name: true, category: true, cuisineTags: true, flavorTags: true },
    });
    for (const ing of extras) {
      ingredientMap.set(ing.id, {
        name: ing.name,
        category: ing.category,
        cuisineTags: ing.cuisineTags,
        flavorTags: parseFlavorTags(ing.flavorTags),
        recipeIds: new Set(),
      });
    }
  }

  // ── Per-ingredient cook stats ────────────────────────
  const ingredientCookStats = new Map<
    string,
    { cookCount: number; lastCooked: Date | null; ratingSum: number; ratingCount: number }
  >();

  for (const [ingredientId, entry] of ingredientMap) {
    let cookCount = 0;
    let lastCooked: Date | null = null;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const recipeId of entry.recipeIds) {
      const cookInfo = recipeCookCounts.get(recipeId);
      if (cookInfo) {
        cookCount += cookInfo.count;
        if (!lastCooked || cookInfo.lastCooked > lastCooked) {
          lastCooked = cookInfo.lastCooked;
        }
      }
      const ratingInfo = recipeRatingMap.get(recipeId);
      if (ratingInfo) {
        ratingSum += ratingInfo.sum;
        ratingCount += ratingInfo.count;
      }
    }

    ingredientCookStats.set(ingredientId, {
      cookCount,
      lastCooked,
      ratingSum,
      ratingCount,
    });
  }

  // ── Build nodes ──────────────────────────────────────
  const categoryClusterCentroids: Record<string, { count: number }> = {};
  let maxCookCount = 0;

  const nodes: TopologyNode[] = [];
  for (const id of nodeIds) {
    const entry = ingredientMap.get(id);
    if (!entry) continue;

    const stats = ingredientCookStats.get(id);
    const cookCount = stats?.cookCount ?? 0;
    if (cookCount > maxCookCount) maxCookCount = cookCount;

    const cat = entry.category as string;
    if (!categoryClusterCentroids[cat]) {
      categoryClusterCentroids[cat] = { count: 0 };
    }
    categoryClusterCentroids[cat].count++;

    nodes.push({
      id,
      name: entry.name,
      category: entry.category,
      recipeCount: entry.recipeIds.size,
      synergyStrength: synergyById.get(id) ?? 0,
      inPantry: pantryIngredientIds.has(id),
      cuisineTags: entry.cuisineTags,
      flavorTags: entry.flavorTags,
      cookCount,
      avgRating:
        stats && stats.ratingCount > 0
          ? Math.round((stats.ratingSum / stats.ratingCount) * 10) / 10
          : null,
      lastCooked: stats?.lastCooked?.toISOString() ?? null,
      substituteGroupIds: [...(ingredientSubstituteGroups.get(id) ?? [])],
    });
  }

  nodes.sort((a, b) => a.name.localeCompare(b.name));

  const linksConnected = addSyntheticBridgeLinks(nodes, links, synergyById);

  const totalConnections = linksConnected.length;
  const totalIngredients = nodes.length;
  const avgConnectionsPerNode =
    totalIngredients > 0
      ? Math.round((totalConnections * 2 * 100) / totalIngredients) / 100
      : 0;

  return {
    nodes,
    links: linksConnected,
    stats: {
      totalIngredients,
      totalConnections,
      avgConnectionsPerNode,
      strongestConnection: strongest
        ? {
            source: strongest.source,
            target: strongest.target,
            weight: strongest.weight,
          }
        : null,
    },
    meta: {
      maxCookCount,
      maxFlavorAffinity,
      categoryClusterCentroids,
    },
    recipes: recipeSummaries.slice(0, 50), // top 50 by pantry match
  };
}

// ---------------------------------------------------------------------------
// Pantry network hub names (unchanged logic, used by pantry-bridge)
// ---------------------------------------------------------------------------

/**
 * Stocked ingredients that share the most recipe co-occurrence neighbors in the active cookbook
 * (graph hubs). Used to steer OpenAI toward bridge recipes that densify the ingredient network.
 */
export async function getPantryNetworkHubIngredientNames(
  userId: string,
  limit: number,
): Promise<string[]> {
  const recipes = await prisma.recipe.findMany({
    where: { status: "active", AND: [recipeVisibilityClause(userId)] },
    select: {
      ingredients: {
        select: { ingredient: { select: { id: true, name: true } } },
      },
    },
  });

  const neighborSets = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    const ids: string[] = [];
    for (const ri of recipe.ingredients) {
      const ing = ri.ingredient;
      if (isTopologyExcludedIngredient(ing.name)) continue;
      ids.push(ing.id);
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        if (!neighborSets.has(a)) neighborSets.set(a, new Set());
        if (!neighborSets.has(b)) neighborSets.set(b, new Set());
        neighborSets.get(a)!.add(b);
        neighborSets.get(b)!.add(a);
      }
    }
  }

  const rows = await prisma.inventory.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: { ingredient: { select: { id: true, name: true } } },
  });

  const scored = rows.map((row) => ({
    name: row.ingredient.name,
    degree: neighborSets.get(row.ingredientId)?.size ?? 0,
  }));

  scored.sort(
    (a, b) => b.degree - a.degree || a.name.localeCompare(b.name),
  );

  const out: string[] = [];
  const seen = new Set<string>();
  for (const { name } of scored) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

export interface UnlinkedPantryIngredient {
  id: string;
  name: string;
  category: IngredientCategory;
}

/**
 * Pantry items (qty > 0) that never co-occur with another ingredient in any active recipe
 * (same linkage rule as the food web's "unlinked" nodes, global catalog).
 */
export async function getUnlinkedPantryIngredients(
  userId: string,
): Promise<{
  unlinked: UnlinkedPantryIngredient[];
  /** Stocked pantry items that already co-occur with another ingredient in the cookbook graph. */
  linkedCorpusPantry: UnlinkedPantryIngredient[];
  totalPantryWithStock: number;
  linkedPantryCount: number;
}> {
  const recipes = await prisma.recipe.findMany({
    where: { status: "active", AND: [recipeVisibilityClause(userId)] },
    select: {
      ingredients: {
        select: {
          ingredient: { select: { id: true, name: true } },
        },
      },
    },
  });

  const coOccurrences = new Map<string, number>();
  for (const recipe of recipes) {
    const ids: string[] = [];
    for (const ri of recipe.ingredients) {
      const ing = ri.ingredient;
      if (isTopologyExcludedIngredient(ing.name)) continue;
      ids.push(ing.id);
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i], ids[j]);
        coOccurrences.set(k, (coOccurrences.get(k) ?? 0) + 1);
      }
    }
  }

  const connectedIds = new Set<string>();
  for (const [k, c] of coOccurrences) {
    if (c < 1) continue;
    const [a, b] = k.split("::");
    connectedIds.add(a);
    connectedIds.add(b);
  }

  const rows = await prisma.inventory.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: {
      ingredient: { select: { id: true, name: true, category: true } },
    },
  });

  const pantryIds = new Set(rows.map((r) => r.ingredientId));
  const unlinkedById = new Map<string, UnlinkedPantryIngredient>();

  for (const row of rows) {
    const ing = row.ingredient;
    if (connectedIds.has(ing.id)) continue;
    unlinkedById.set(ing.id, {
      id: ing.id,
      name: ing.name,
      category: ing.category,
    });
  }

  const linkedPantryCount = [...pantryIds].filter((id) =>
    connectedIds.has(id),
  ).length;

  const linkedCorpusPantry: UnlinkedPantryIngredient[] = [];
  for (const row of rows) {
    const ing = row.ingredient;
    if (!connectedIds.has(ing.id)) continue;
    linkedCorpusPantry.push({
      id: ing.id,
      name: ing.name,
      category: ing.category,
    });
  }
  linkedCorpusPantry.sort((a, b) => a.name.localeCompare(b.name));

  return {
    unlinked: [...unlinkedById.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    linkedCorpusPantry,
    totalPantryWithStock: pantryIds.size,
    linkedPantryCount,
  };
}
