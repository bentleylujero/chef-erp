import type { Prisma } from "@prisma/client";
import {
  quantityFromBase,
  quantityToBase,
  scaleQuantity,
} from "@/lib/utils/units";

const EPS = 1e-5;

export type PantryDeductionResult = {
  deductions: Array<{
    ingredientId: string;
    name: string;
    quantityRemoved: number;
    unit: string;
    partial: boolean;
  }>;
  skipped: Array<{
    ingredientId: string;
    name: string;
    reason: "optional" | "not_in_pantry" | "unit_mismatch" | "unknown_unit";
  }>;
};

/**
 * Removes scaled recipe ingredient amounts from the user's pantry (FIFO by expiry).
 * Optional ingredients are not deducted. Unknown / incompatible units are skipped.
 */
export async function deductPantryForCookedRecipe(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    recipeId: string;
    servingsCooked: number | null | undefined;
  },
): Promise<PantryDeductionResult> {
  const deductions: PantryDeductionResult["deductions"] = [];
  const skipped: PantryDeductionResult["skipped"] = [];

  const recipe = await tx.recipe.findUnique({
    where: { id: params.recipeId },
    select: {
      servings: true,
      ingredients: {
        select: {
          ingredientId: true,
          quantity: true,
          unit: true,
          isOptional: true,
          ingredient: { select: { name: true } },
        },
      },
    },
  });

  if (!recipe || recipe.servings <= 0) {
    return { deductions, skipped };
  }

  const targetServings =
    params.servingsCooked != null &&
    Number.isFinite(params.servingsCooked) &&
    params.servingsCooked > 0
      ? params.servingsCooked
      : recipe.servings;

  const scaleFactor = targetServings / recipe.servings;

  for (const line of recipe.ingredients) {
    if (line.isOptional) {
      skipped.push({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        reason: "optional",
      });
      continue;
    }

    const scaled = scaleQuantity(line.quantity, line.unit, scaleFactor);
    const needBase = quantityToBase(scaled.quantity, scaled.unit);
    if (!needBase) {
      skipped.push({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        reason: "unknown_unit",
      });
      continue;
    }

    const rows = await tx.inventory.findMany({
      where: {
        userId: params.userId,
        ingredientId: line.ingredientId,
        quantity: { gt: EPS },
      },
      orderBy: { expiryDate: "asc" },
    });

    if (rows.length === 0) {
      skipped.push({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        reason: "not_in_pantry",
      });
      continue;
    }

    let remaining = needBase.value;
    let totalRemovedBase = 0;
    let incompatible = true;

    for (const row of rows) {
      if (remaining < EPS) break;

      const rowBase = quantityToBase(row.quantity, row.unit);
      if (!rowBase || rowBase.dimension !== needBase.dimension) {
        continue;
      }
      incompatible = false;

      const take = Math.min(rowBase.value, remaining);
      remaining -= take;
      totalRemovedBase += take;

      const newRowBase = rowBase.value - take;
      if (newRowBase < EPS) {
        await tx.inventory.delete({ where: { id: row.id } });
      } else {
        const newQty = quantityFromBase(
          newRowBase,
          needBase.dimension,
          row.unit,
        );
        const resolvedQty =
          newQty ??
          (rowBase.value > EPS ? (row.quantity * newRowBase) / rowBase.value : 0);
        if (!Number.isFinite(resolvedQty) || resolvedQty < EPS) {
          await tx.inventory.delete({ where: { id: row.id } });
        } else {
          await tx.inventory.update({
            where: { id: row.id },
            data: { quantity: resolvedQty },
          });
        }
      }
    }

    if (incompatible) {
      skipped.push({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        reason: "unit_mismatch",
      });
      continue;
    }

    const partial = remaining > EPS;
    const displayUnit = scaled.unit;
    const removedInDisplayUnit =
      quantityFromBase(totalRemovedBase, needBase.dimension, displayUnit) ??
      totalRemovedBase;

    if (totalRemovedBase < EPS) {
      skipped.push({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        reason: "not_in_pantry",
      });
      continue;
    }

    deductions.push({
      ingredientId: line.ingredientId,
      name: line.ingredient.name,
      quantityRemoved: removedInDisplayUnit,
      unit: displayUnit,
      partial,
    });
  }

  return { deductions, skipped };
}
