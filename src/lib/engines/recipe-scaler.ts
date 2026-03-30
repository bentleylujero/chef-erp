import { formatQuantity, scaleQuantity } from "@/lib/utils/units";

export type ScaledIngredient = {
  quantity: number;
  unit: string;
  name: string;
  displayQuantity: string;
};

export function scaleRecipe(
  ingredients: Array<{ quantity: number; unit: string; name: string }>,
  fromServings: number,
  toServings: number,
): ScaledIngredient[] {
  if (
    !Number.isFinite(fromServings) ||
    !Number.isFinite(toServings) ||
    fromServings <= 0
  ) {
    return ingredients.map((ing) => ({
      quantity: ing.quantity,
      unit: ing.unit,
      name: ing.name,
      displayQuantity: formatQuantity(ing.quantity, ing.unit),
    }));
  }

  const factor = toServings / fromServings;

  return ingredients.map((ing) => {
    const scaled = scaleQuantity(ing.quantity, ing.unit, factor);
    return {
      quantity: scaled.quantity,
      unit: scaled.unit,
      name: ing.name,
      displayQuantity: formatQuantity(scaled.quantity, scaled.unit),
    };
  });
}
