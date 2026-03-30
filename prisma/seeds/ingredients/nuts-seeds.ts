type IngredientCategory =
  | "PANTRY_STAPLE"
  | "CONDIMENT"
  | "OIL_FAT"
  | "GRAIN"
  | "LEGUME"
  | "NUT_SEED"
  | "BAKING";

type StorageType = "FRIDGE" | "FREEZER" | "PANTRY" | "COUNTER";

type FlavorTags = {
  sweet: number;
  spicy: number;
  umami: number;
  acidic: number;
  rich: number;
  light: number;
};

type NutSeedIngredientSeed = {
  name: string;
  category: IngredientCategory;
  defaultUnit: string;
  shelfLifeDays: number;
  storageType: StorageType;
  avgPricePerUnit: number;
  cuisineTags: string[];
  flavorTags: FlavorTags;
  description: string;
};

export const nutsSeeds: NutSeedIngredientSeed[] = [
  {
    name: "Almonds (raw)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.022,
    cuisineTags: ["MIDDLE_EASTERN", "MEDITERRANEAN", "AMERICAN", "FRENCH"],
    flavorTags: { sweet: 2, spicy: 0, umami: 2, acidic: 0, rich: 6, light: 3 },
    description: "Whole or slivered almonds for frangipane, granola, and savory crusts.",
  },
  {
    name: "Walnuts (halves)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 270,
    storageType: "FRIDGE",
    avgPricePerUnit: 0.028,
    cuisineTags: ["AMERICAN", "FRENCH", "MIDDLE_EASTERN"],
    flavorTags: { sweet: 2, spicy: 0, umami: 3, acidic: 1, rich: 7, light: 2 },
    description: "Buttery bittersweet nuts for brownies, pestos, and fall salads.",
  },
  {
    name: "Pine nuts",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 180,
    storageType: "FRIDGE",
    avgPricePerUnit: 0.085,
    cuisineTags: ["ITALIAN", "MIDDLE_EASTERN", "MEDITERRANEAN"],
    flavorTags: { sweet: 2, spicy: 0, umami: 3, acidic: 0, rich: 7, light: 3 },
    description: "Delicate Mediterranean nuts classic in pesto, pilafs, and pinoli cookies.",
  },
  {
    name: "Pecans",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 270,
    storageType: "FRIDGE",
    avgPricePerUnit: 0.032,
    cuisineTags: ["AMERICAN", "SOUTHERN", "MEXICAN"],
    flavorTags: { sweet: 4, spicy: 0, umami: 2, acidic: 0, rich: 8, light: 2 },
    description: "Buttery native nuts for pies, pralines, and candied toppings.",
  },
  {
    name: "Cashews (raw)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.026,
    cuisineTags: ["INDIAN", "THAI", "SOUTHEAST_ASIAN", "FUSION"],
    flavorTags: { sweet: 3, spicy: 0, umami: 3, acidic: 0, rich: 6, light: 3 },
    description: "Creamy nuts for korma bases, vegan cheeses, and stir-fries.",
  },
  {
    name: "Peanuts (roasted, unsalted)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 180,
    storageType: "PANTRY",
    avgPricePerUnit: 0.012,
    cuisineTags: ["AMERICAN", "CHINESE", "THAI", "AFRICAN"],
    flavorTags: { sweet: 2, spicy: 0, umami: 4, acidic: 0, rich: 6, light: 3 },
    description: "Legume-nut workhorse for satay, brittle, and crunchy garnishes.",
  },
  {
    name: "Pistachios (shelled)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 270,
    storageType: "FRIDGE",
    avgPricePerUnit: 0.055,
    cuisineTags: ["MIDDLE_EASTERN", "MEDITERRANEAN", "ITALIAN"],
    flavorTags: { sweet: 3, spicy: 0, umami: 3, acidic: 0, rich: 6, light: 4 },
    description: "Vibrant green nuts for baklava, mortadella studding, and dukkah.",
  },
  {
    name: "Hazelnuts (blanched)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.038,
    cuisineTags: ["FRENCH", "ITALIAN", "OTHER"],
    flavorTags: { sweet: 3, spicy: 0, umami: 3, acidic: 0, rich: 8, light: 2 },
    description: "Toasted for praline, gianduja, and frangipane; classic with chocolate.",
  },
  {
    name: "Sesame seeds",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.018,
    cuisineTags: ["CHINESE", "JAPANESE", "KOREAN", "MIDDLE_EASTERN"],
    flavorTags: { sweet: 1, spicy: 0, umami: 4, acidic: 0, rich: 5, light: 4 },
    description: "Toasted for gomashio, buns, and tahini; white or black for contrast.",
  },
  {
    name: "Poppy seeds",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 730,
    storageType: "PANTRY",
    avgPricePerUnit: 0.045,
    cuisineTags: ["MIDDLE_EASTERN", "EASTERN_EUROPEAN", "AMERICAN"],
    flavorTags: { sweet: 1, spicy: 0, umami: 2, acidic: 0, rich: 4, light: 5 },
    description: "Tiny blue-black seeds for hamantaschen, lemon cakes, and noodle toppings.",
  },
  {
    name: "Sunflower seeds (hulled)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.014,
    cuisineTags: ["AMERICAN", "MIDDLE_EASTERN", "FUSION"],
    flavorTags: { sweet: 1, spicy: 0, umami: 2, acidic: 0, rich: 4, light: 5 },
    description: "Mild crunch for salads, breads, and seed brittle.",
  },
  {
    name: "Pepitas (pumpkin seeds)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.024,
    cuisineTags: ["MEXICAN", "AMERICAN", "MIDDLE_EASTERN"],
    flavorTags: { sweet: 1, spicy: 0, umami: 3, acidic: 0, rich: 5, light: 4 },
    description: "Hulled green seeds for mole garnish, granola, and roasted snacks.",
  },
  {
    name: "Flax seeds (whole)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.012,
    cuisineTags: ["AMERICAN", "OTHER"],
    flavorTags: { sweet: 0, spicy: 0, umami: 2, acidic: 0, rich: 4, light: 5 },
    description: "Omega-rich seeds; grind for egg replacers, fiber in doughs, and smoothies.",
  },
  {
    name: "Chia seeds",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 730,
    storageType: "PANTRY",
    avgPricePerUnit: 0.028,
    cuisineTags: ["FUSION", "AMERICAN", "OTHER"],
    flavorTags: { sweet: 1, spicy: 0, umami: 1, acidic: 0, rich: 3, light: 6 },
    description: "Gel-forming seeds for puddings, hydration in batters, and texture in bars.",
  },
  {
    name: "Coconut (shredded, unsweetened)",
    category: "NUT_SEED",
    defaultUnit: "g",
    shelfLifeDays: 365,
    storageType: "PANTRY",
    avgPricePerUnit: 0.016,
    cuisineTags: ["THAI", "SOUTHEAST_ASIAN", "CARIBBEAN", "INDIAN"],
    flavorTags: { sweet: 3, spicy: 0, umami: 2, acidic: 0, rich: 6, light: 4 },
    description: "Dried coconut for macaroons, curries, and cake layers; toast for aroma.",
  },
];
