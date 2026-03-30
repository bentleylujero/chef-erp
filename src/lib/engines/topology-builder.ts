import { prisma } from "@/lib/prisma";
import type { Cuisine, IngredientCategory } from "@prisma/client";

export interface TopologyNode {
  id: string;
  name: string;
  category: string;
  recipeCount: number;
  inPantry: boolean;
  cuisineTags: string[];
}

export interface TopologyLink {
  source: string;
  target: string;
  weight: number;
  recipes: string[];
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
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
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

export async function buildTopologyData(
  userId: string,
  filters?: {
    cuisine?: string;
    pantryOnly?: boolean;
    minWeight?: number;
  },
): Promise<TopologyData> {
  const recipeWhere: Record<string, unknown> = { status: "active" };
  if (filters?.cuisine) {
    recipeWhere.cuisine = filters.cuisine as Cuisine;
  }

  const recipes = await prisma.recipe.findMany({
    where: recipeWhere,
    select: {
      id: true,
      title: true,
      ingredients: {
        select: {
          ingredient: {
            select: {
              id: true,
              name: true,
              category: true,
              cuisineTags: true,
            },
          },
        },
      },
    },
  });

  const pantryIngredientIds = new Set(
    (
      await prisma.inventory.findMany({
        where: { userId },
        select: { ingredientId: true },
      })
    ).map((inv) => inv.ingredientId),
  );

  const ingredientMap = new Map<
    string,
    {
      name: string;
      category: IngredientCategory;
      cuisineTags: Cuisine[];
      recipeIds: Set<string>;
    }
  >();

  const coOccurrences = new Map<
    string,
    { count: number; recipeTitles: string[] }
  >();

  for (const recipe of recipes) {
    const ingredientIds: string[] = [];

    for (const ri of recipe.ingredients) {
      const ing = ri.ingredient;
      if (isTopologyExcludedIngredient(ing.name)) continue;

      ingredientIds.push(ing.id);

      let entry = ingredientMap.get(ing.id);
      if (!entry) {
        entry = {
          name: ing.name,
          category: ing.category,
          cuisineTags: ing.cuisineTags,
          recipeIds: new Set(),
        };
        ingredientMap.set(ing.id, entry);
      }
      entry.recipeIds.add(recipe.id);
    }

    for (let i = 0; i < ingredientIds.length; i++) {
      for (let j = i + 1; j < ingredientIds.length; j++) {
        const key = pairKey(ingredientIds[i], ingredientIds[j]);
        let pair = coOccurrences.get(key);
        if (!pair) {
          pair = { count: 0, recipeTitles: [] };
          coOccurrences.set(key, pair);
        }
        pair.count++;
        if (pair.recipeTitles.length < 5) {
          pair.recipeTitles.push(recipe.title);
        }
      }
    }
  }

  const minWeight = filters?.minWeight ?? 1;
  const connectedIds = new Set<string>();

  const links: TopologyLink[] = [];
  let strongest: TopologyLink | null = null;

  for (const [key, pair] of coOccurrences) {
    if (pair.count < minWeight) continue;

    const [sourceId, targetId] = key.split("::");

    if (filters?.pantryOnly) {
      if (!pantryIngredientIds.has(sourceId) || !pantryIngredientIds.has(targetId)) {
        continue;
      }
    }

    const link: TopologyLink = {
      source: sourceId,
      target: targetId,
      weight: pair.count,
      recipes: pair.recipeTitles,
    };

    links.push(link);
    connectedIds.add(sourceId);
    connectedIds.add(targetId);

    if (!strongest || pair.count > strongest.weight) {
      strongest = link;
    }
  }

  const nodes: TopologyNode[] = [];
  for (const id of connectedIds) {
    const entry = ingredientMap.get(id);
    if (!entry) continue;

    nodes.push({
      id,
      name: entry.name,
      category: entry.category,
      recipeCount: entry.recipeIds.size,
      inPantry: pantryIngredientIds.has(id),
      cuisineTags: entry.cuisineTags,
    });
  }

  const totalConnections = links.length;
  const totalIngredients = nodes.length;
  const avgConnectionsPerNode =
    totalIngredients > 0
      ? Math.round((totalConnections * 2 * 100) / totalIngredients) / 100
      : 0;

  return {
    nodes,
    links,
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
  };
}
