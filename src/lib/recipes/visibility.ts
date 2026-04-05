import type { Prisma } from "@prisma/client";

/**
 * System templates (`ownerUserId` null) plus recipes owned by `userId`.
 * When `userId` is null (unauthenticated), only system templates are visible.
 */
export function recipeVisibilityClause(
  userId: string | null,
): Prisma.RecipeWhereInput {
  if (userId) {
    return { OR: [{ ownerUserId: null }, { ownerUserId: userId }] };
  }
  return { ownerUserId: null };
}
