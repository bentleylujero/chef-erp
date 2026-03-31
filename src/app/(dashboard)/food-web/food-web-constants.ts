// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const HUD = {
  bg: "#08080d",
  panel: "rgba(8,8,13,0.82)",
  border: "rgba(26,26,46,0.7)",
  cyan: "#00e5ff",
  cyanDim: "rgba(0,229,255,0.15)",
  amber: "#ffab00",
  green: "#0eca78",
  textPrimary: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#475569",
  textGhost: "#334155",
} as const;

/** Obsidian graph-inspired canvas palette. */
export const WEB = {
  canvasBg: "#141418",
  edge: "rgba(200, 205, 218, 0.28)",
  edgeDim: "rgba(200, 205, 218, 0.12)",
  edgeHover: "rgba(230, 235, 240, 0.42)",
  edgeGlow: "rgba(230, 235, 240, 0.08)",
  dotNoise: "rgba(255, 255, 255, 0.018)",
  label: "#d0d0d0",
  labelMuted: "#8c8c8c",
} as const;

// ---------------------------------------------------------------------------
// Cuisines
// ---------------------------------------------------------------------------

export const CUISINES = [
  { value: "FRENCH", label: "French" },
  { value: "ITALIAN", label: "Italian" },
  { value: "DELI", label: "Deli" },
  { value: "MEXICAN", label: "Mexican" },
  { value: "MEDITERRANEAN", label: "Mediterranean" },
  { value: "JAPANESE", label: "Japanese" },
  { value: "THAI", label: "Thai" },
  { value: "KOREAN", label: "Korean" },
  { value: "CHINESE", label: "Chinese" },
  { value: "INDIAN", label: "Indian" },
  { value: "AMERICAN", label: "American" },
  { value: "MIDDLE_EASTERN", label: "Middle Eastern" },
  { value: "AFRICAN", label: "African" },
  { value: "CARIBBEAN", label: "Caribbean" },
  { value: "SOUTHEAST_ASIAN", label: "Southeast Asian" },
  { value: "FUSION", label: "Fusion" },
  { value: "OTHER", label: "Other" },
] as const;

// ---------------------------------------------------------------------------
// Category colors & labels
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<string, string> = {
  // Proteins
  POULTRY: "#ff5c8a",
  RED_MEAT: "#e63946",
  SEAFOOD: "#48bfe3",
  CURED_DELI: "#d4627a",
  PROTEIN: "#ff3d71",
  // Produce
  VEGETABLE: "#0eca78",
  FRUIT: "#ffa62b",
  AROMATIC: "#b8e986",
  MUSHROOM: "#a68a64",
  PRODUCE: "#0eca78",
  // Dairy & Cheese
  DAIRY: "#3d8bfd",
  CHEESE: "#f4d35e",
  // Condiments
  SAUCE: "#c77dff",
  PASTE: "#e07be0",
  VINEGAR: "#9d4edd",
  CONDIMENT: "#a56eff",
  // Pantry
  SPICE: "#ff8a00",
  HERB: "#00d68f",
  GRAIN: "#e8c547",
  OIL_FAT: "#f7d94c",
  NUT_SEED: "#c4956a",
  PANTRY_STAPLE: "#6b7a8d",
  LEGUME: "#8bff42",
  SWEETENER: "#ff6b9d",
  BEVERAGE: "#00cfff",
  BAKING: "#d066ff",
  OTHER: "#8895a7",
};

export const CATEGORY_LABELS: Record<string, string> = {
  POULTRY: "Poultry",
  RED_MEAT: "Red Meat",
  SEAFOOD: "Seafood",
  CURED_DELI: "Cured / Deli",
  PROTEIN: "Protein",
  VEGETABLE: "Vegetable",
  FRUIT: "Fruit",
  AROMATIC: "Aromatic",
  MUSHROOM: "Mushroom",
  PRODUCE: "Produce",
  DAIRY: "Dairy",
  CHEESE: "Cheese",
  SAUCE: "Sauce",
  PASTE: "Paste",
  VINEGAR: "Vinegar",
  CONDIMENT: "Condiment",
  SPICE: "Spice",
  HERB: "Herb",
  GRAIN: "Grain",
  OIL_FAT: "Oil / Fat",
  NUT_SEED: "Nut / Seed",
  PANTRY_STAPLE: "Pantry Staple",
  LEGUME: "Legume",
  SWEETENER: "Sweetener",
  BEVERAGE: "Beverage",
  BAKING: "Baking",
  OTHER: "Other",
};

/** Super-groups for the collapsible legend. */
export const CATEGORY_GROUPS: { label: string; categories: string[] }[] = [
  {
    label: "Proteins",
    categories: ["POULTRY", "RED_MEAT", "SEAFOOD", "CURED_DELI", "PROTEIN"],
  },
  {
    label: "Produce",
    categories: ["VEGETABLE", "FRUIT", "AROMATIC", "MUSHROOM", "PRODUCE"],
  },
  { label: "Dairy", categories: ["DAIRY", "CHEESE"] },
  { label: "Condiments", categories: ["SAUCE", "PASTE", "VINEGAR", "CONDIMENT"] },
  {
    label: "Pantry",
    categories: [
      "SPICE",
      "HERB",
      "GRAIN",
      "OIL_FAT",
      "NUT_SEED",
      "PANTRY_STAPLE",
      "LEGUME",
      "SWEETENER",
      "BEVERAGE",
      "BAKING",
      "OTHER",
    ],
  },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
