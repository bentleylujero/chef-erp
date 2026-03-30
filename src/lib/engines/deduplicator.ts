import Fuse from "fuse.js";
import { prisma } from "@/lib/prisma";

export async function isDuplicate(
  newTitle: string,
  newIngredientNames: string[],
  cuisine: string,
): Promise<{ isDuplicate: boolean; existingRecipeId?: string }> {
  const existingRecipes = await prisma.recipe.findMany({
    where: { status: "active" },
    select: {
      id: true,
      title: true,
      cuisine: true,
      ingredients: {
        select: { ingredient: { select: { name: true } } },
      },
    },
  });

  if (existingRecipes.length === 0) return { isDuplicate: false };

  const fuse = new Fuse(existingRecipes, {
    keys: ["title"],
    threshold: 0.3,
    includeScore: true,
  });

  const titleMatches = fuse.search(newTitle);

  for (const match of titleMatches) {
    if (match.score !== undefined && match.score > 0.3) continue;

    const existing = match.item;
    if (existing.cuisine !== cuisine) continue;

    const existingNames = new Set(
      existing.ingredients.map((ri) => ri.ingredient.name.toLowerCase()),
    );
    const newNames = new Set(
      newIngredientNames.map((n) => n.toLowerCase()),
    );

    let intersectionSize = 0;
    for (const name of newNames) {
      if (existingNames.has(name)) intersectionSize++;
    }

    const largerSetSize = Math.max(existingNames.size, newNames.size);
    if (largerSetSize > 0 && intersectionSize / largerSetSize > 0.8) {
      return { isDuplicate: true, existingRecipeId: existing.id };
    }
  }

  return { isDuplicate: false };
}
