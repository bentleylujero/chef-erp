/**
 * Recipe embedding service — generates and stores OpenAI embeddings for
 * semantic search (cookbook RAG).
 *
 * Uses `text-embedding-3-small` (1536-dim) and stores vectors directly in
 * PostgreSQL via pgvector.  Prisma doesn't natively support the `vector`
 * type, so all vector I/O uses raw SQL through `prisma.$queryRawUnsafe`.
 */

import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Text builder
// ---------------------------------------------------------------------------

interface RecipeForEmbedding {
  title: string;
  description: string;
  cuisine: string;
  techniques: string[];
  tags: string[];
  ingredients: { ingredient: { name: string } }[];
}

/** Deterministic serialisation of a recipe into embedding-ready text. */
export function buildRecipeEmbeddingText(r: RecipeForEmbedding): string {
  const parts = [
    `Title: ${r.title}`,
    `Cuisine: ${r.cuisine}`,
    `Description: ${r.description}`,
    `Techniques: ${r.techniques.join(", ")}`,
    `Ingredients: ${r.ingredients.map((i) => i.ingredient.name).join(", ")}`,
    `Tags: ${r.tags.join(", ")}`,
  ];
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Generate embedding
// ---------------------------------------------------------------------------

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Store helpers (raw SQL for pgvector)
// ---------------------------------------------------------------------------

async function storeEmbedding(
  recipeId: string,
  embedding: number[],
): Promise<void> {
  const vec = `[${embedding.join(",")}]`;
  await prisma.$queryRawUnsafe(
    `UPDATE "Recipe" SET "embedding" = $1::vector WHERE "id" = $2`,
    vec,
    recipeId,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Embed a single recipe by ID. */
export async function embedRecipe(recipeId: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      title: true,
      description: true,
      cuisine: true,
      techniques: true,
      tags: true,
      ingredients: { select: { ingredient: { select: { name: true } } } },
    },
  });
  if (!recipe) return;

  const text = buildRecipeEmbeddingText(recipe);
  const embedding = await generateEmbedding(text);
  await storeEmbedding(recipeId, embedding);
}

/** Embed multiple recipes in batches of BATCH_SIZE. */
export async function embedRecipesBatch(
  recipeIds: string[],
): Promise<number> {
  let embedded = 0;

  for (let i = 0; i < recipeIds.length; i += BATCH_SIZE) {
    const chunk = recipeIds.slice(i, i + BATCH_SIZE);

    const recipes = await prisma.recipe.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true,
        title: true,
        description: true,
        cuisine: true,
        techniques: true,
        tags: true,
        ingredients: { select: { ingredient: { select: { name: true } } } },
      },
    });

    const texts = recipes.map((r: RecipeForEmbedding) =>
      buildRecipeEmbeddingText(r),
    );

    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    for (let j = 0; j < recipes.length; j++) {
      await storeEmbedding(recipes[j].id, res.data[j].embedding);
      embedded++;
    }
  }

  return embedded;
}

/** Find and embed all recipes that don't yet have an embedding. */
export async function embedAllUnembeddedRecipes(): Promise<number> {
  const rows: { id: string }[] = await prisma.$queryRawUnsafe(
    `SELECT "id" FROM "Recipe" WHERE "embedding" IS NULL AND "status" = 'active'`,
  );

  if (rows.length === 0) return 0;

  return embedRecipesBatch(rows.map((r) => r.id));
}
