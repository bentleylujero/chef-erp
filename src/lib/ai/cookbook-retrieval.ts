/**
 * Cookbook RAG retrieval — semantic search over recipe embeddings.
 *
 * Used by the generation pipeline to inject similar-recipe context into
 * prompts, improving diversity and preventing duplicates.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "./embedding-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimilarRecipe {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  difficulty: number;
  similarity: number;
  tags: string[];
}

interface RetrievalOptions {
  topK?: number;
  cuisineFilter?: string;
  excludeIds?: string[];
}

// ---------------------------------------------------------------------------
// Core search
// ---------------------------------------------------------------------------

/**
 * Semantic similarity search over the recipe embedding index.
 * Returns the top-K most similar recipes to the query text.
 */
export async function searchSimilarRecipes(
  query: string,
  options: RetrievalOptions = {},
): Promise<SimilarRecipe[]> {
  const { topK = 5, cuisineFilter, excludeIds = [] } = options;

  const embedding = await generateEmbedding(query);
  const vec = `[${embedding.join(",")}]`;

  // Build dynamic WHERE clauses
  const conditions = [
    `r."embedding" IS NOT NULL`,
    `r."status" = 'active'`,
  ];
  const params: unknown[] = [vec, topK];
  let paramIdx = 3;

  if (cuisineFilter) {
    conditions.push(`r."cuisine" = $${paramIdx}::text::"Cuisine"`);
    params.push(cuisineFilter);
    paramIdx++;
  }

  if (excludeIds.length > 0) {
    conditions.push(`r."id" != ALL($${paramIdx}::text[])`);
    params.push(excludeIds);
    paramIdx++;
  }

  const whereClause = conditions.join(" AND ");

  const rows: SimilarRecipe[] = await prisma.$queryRawUnsafe(
    `SELECT
       r."id",
       r."title",
       r."description",
       r."cuisine"::text AS cuisine,
       r."difficulty",
       r."tags",
       1 - (r."embedding" <=> $1::vector) AS similarity
     FROM "Recipe" r
     WHERE ${whereClause}
     ORDER BY r."embedding" <=> $1::vector
     LIMIT $2`,
    ...params,
  );

  return rows;
}

// ---------------------------------------------------------------------------
// RAG context builder
// ---------------------------------------------------------------------------

/**
 * High-level RAG function: searches for similar recipes and formats them
 * as a compact text block ready for injection into generation prompts.
 */
export async function buildRAGContext(
  query: string,
  options: RetrievalOptions = {},
): Promise<string | undefined> {
  const results = await searchSimilarRecipes(query, options);

  if (results.length === 0) return undefined;

  // Fetch ingredient names for each retrieved recipe
  const recipeIds = results.map((r) => r.id);
  const ingredients = await prisma.recipeIngredient.findMany({
    where: { recipeId: { in: recipeIds } },
    select: {
      recipeId: true,
      ingredient: { select: { name: true } },
    },
  });

  const ingredientsByRecipe = new Map<string, string[]>();
  for (const ri of ingredients) {
    const list = ingredientsByRecipe.get(ri.recipeId) ?? [];
    list.push(ri.ingredient.name);
    ingredientsByRecipe.set(ri.recipeId, list);
  }

  const lines = results.map((r, i) => {
    const ings = ingredientsByRecipe.get(r.id)?.join(", ") ?? "";
    return `${i + 1}. ${r.title} (${r.cuisine}) — ${ings}`;
  });

  return lines.join("\n");
}
