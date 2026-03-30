import { IngredientCategory } from "@prisma/client";

export const INGREDIENT_CATEGORIES: Record<
  IngredientCategory,
  { label: string; color: string }
> = {
  // Proteins (fine-grained)
  POULTRY: {
    label: "Poultry",
    color: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100",
  },
  RED_MEAT: {
    label: "Red Meat",
    color: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  },
  SEAFOOD: {
    label: "Seafood",
    color: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
  },
  CURED_DELI: {
    label: "Cured / Deli",
    color: "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-100",
  },
  PROTEIN: {
    label: "Protein",
    color: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100",
  },

  // Produce (fine-grained)
  VEGETABLE: {
    label: "Vegetable",
    color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  },
  FRUIT: {
    label: "Fruit",
    color: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  },
  AROMATIC: {
    label: "Aromatic",
    color: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-100",
  },
  MUSHROOM: {
    label: "Mushroom",
    color: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  },
  PRODUCE: {
    label: "Produce",
    color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  },

  // Dairy & Cheese
  DAIRY: {
    label: "Dairy",
    color: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  },
  CHEESE: {
    label: "Cheese",
    color: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
  },

  // Condiments (fine-grained)
  SAUCE: {
    label: "Sauce",
    color: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
  },
  PASTE: {
    label: "Paste",
    color: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-100",
  },
  VINEGAR: {
    label: "Vinegar",
    color: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-100",
  },
  CONDIMENT: {
    label: "Condiment",
    color: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
  },

  // Unchanged
  PANTRY_STAPLE: {
    label: "Pantry",
    color: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  },
  SPICE: {
    label: "Spice",
    color: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  },
  GRAIN: {
    label: "Grain",
    color: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
  },
  LEGUME: {
    label: "Legume",
    color: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-100",
  },
  OIL_FAT: {
    label: "Oil & Fat",
    color: "bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-50",
  },
  HERB: {
    label: "Herb",
    color: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100",
  },
  NUT_SEED: {
    label: "Nut & Seed",
    color: "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100",
  },
  SWEETENER: {
    label: "Sweetener",
    color: "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-100",
  },
  BEVERAGE: {
    label: "Beverage",
    color: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100",
  },
  BAKING: {
    label: "Baking",
    color: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-100",
  },
  OTHER: {
    label: "Other",
    color: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  },
};

export const STORE_SECTIONS: readonly string[] = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery & Bread",
  "Frozen",
  "Pantry & Canned",
  "Condiments & Sauces",
  "Spices & Seasonings",
  "Oils & Vinegars",
  "Grains & Pasta",
  "Snacks & Nuts",
  "Beverages",
] as const;

const CATEGORY_TO_SECTION: Record<IngredientCategory, string> = {
  // Proteins
  POULTRY: "Meat & Seafood",
  RED_MEAT: "Meat & Seafood",
  SEAFOOD: "Meat & Seafood",
  CURED_DELI: "Meat & Seafood",
  PROTEIN: "Meat & Seafood",

  // Produce
  VEGETABLE: "Produce",
  FRUIT: "Produce",
  AROMATIC: "Produce",
  MUSHROOM: "Produce",
  PRODUCE: "Produce",

  // Dairy & Cheese
  DAIRY: "Dairy & Eggs",
  CHEESE: "Dairy & Eggs",

  // Condiments
  SAUCE: "Condiments & Sauces",
  PASTE: "Condiments & Sauces",
  VINEGAR: "Oils & Vinegars",
  CONDIMENT: "Condiments & Sauces",

  // Unchanged
  HERB: "Produce",
  BAKING: "Bakery & Bread",
  PANTRY_STAPLE: "Pantry & Canned",
  GRAIN: "Grains & Pasta",
  LEGUME: "Grains & Pasta",
  SPICE: "Spices & Seasonings",
  OIL_FAT: "Oils & Vinegars",
  NUT_SEED: "Snacks & Nuts",
  SWEETENER: "Pantry & Canned",
  BEVERAGE: "Beverages",
  OTHER: "Pantry & Canned",
};

function normalizeCategoryKey(category: string): IngredientCategory | null {
  const trimmed = category.trim();
  if ((Object.values(IngredientCategory) as string[]).includes(trimmed)) {
    return trimmed as IngredientCategory;
  }
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  if ((Object.values(IngredientCategory) as string[]).includes(upper)) {
    return upper as IngredientCategory;
  }
  return null;
}

export function categoryToStoreSection(category: string): string {
  const key = normalizeCategoryKey(category);
  if (key) {
    return CATEGORY_TO_SECTION[key];
  }
  return "Pantry & Canned";
}
