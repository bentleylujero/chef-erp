export function calculateRecipeCost(
  ingredients: Array<{
    quantity: number;
    unit: string;
    avgPricePerUnit: number | null;
  }>,
): number {
  let total = 0;
  for (const ing of ingredients) {
    if (ing.avgPricePerUnit == null || !Number.isFinite(ing.avgPricePerUnit)) {
      continue;
    }
    if (!Number.isFinite(ing.quantity)) continue;
    total += ing.quantity * ing.avgPricePerUnit;
  }
  return total;
}

export function costPerServing(totalCost: number, servings: number): number {
  if (!Number.isFinite(totalCost) || !Number.isFinite(servings) || servings <= 0) {
    return 0;
  }
  return totalCost / servings;
}

export function foodCostPercentage(
  ingredientCost: number,
  platePrice: number,
): number {
  if (
    !Number.isFinite(ingredientCost) ||
    !Number.isFinite(platePrice) ||
    platePrice <= 0
  ) {
    return 0;
  }
  return (ingredientCost / platePrice) * 100;
}
