const VALID_CUISINES = [
  "FRENCH",
  "ITALIAN",
  "DELI",
  "MEXICAN",
  "MEDITERRANEAN",
  "JAPANESE",
  "THAI",
  "KOREAN",
  "CHINESE",
  "INDIAN",
  "AMERICAN",
  "MIDDLE_EASTERN",
  "AFRICAN",
  "CARIBBEAN",
  "SOUTHEAST_ASIAN",
  "FUSION",
  "OTHER",
] as const;

const VALID_TECHNIQUES = [
  "BRAISE",
  "SAUTE",
  "ROAST",
  "GRILL",
  "POACH",
  "STEAM",
  "FRY",
  "DEEP_FRY",
  "CURE",
  "SMOKE",
  "FERMENT",
  "EMULSIFY",
  "LAMINATE",
  "SOUS_VIDE",
  "BLANCH",
  "DEGLAZE",
  "FLAMBE",
  "CONFIT",
  "REDUCE",
  "CARAMELIZE",
  "PICKLE",
  "BRINE",
  "MARINATE",
  "SEAR",
  "STEW",
  "BAKE",
  "BROIL",
  "WHISK",
  "KNEAD",
  "FOLD",
  "TEMPER",
  "CLARIFY",
  "RENDER",
  "CHIFFONADE",
  "BRUNOISE",
  "JULIENNE",
  "MINCE",
  "OTHER",
] as const;

function formatEnum(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupByCategory(
  ingredients: Array<{ name: string; category: string }>,
): string {
  const grouped: Record<string, string[]> = {};
  for (const ing of ingredients) {
    const cat = formatEnum(ing.category);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ing.name);
  }
  return Object.entries(grouped)
    .map(([cat, names]) => `  ${cat}: ${names.join(", ")}`)
    .join("\n");
}

export function buildBatchGenerationPrompt(context: {
  ingredients: Array<{ id: string; name: string; category: string }>;
  cookingStyle: {
    primaryCuisines: string[];
    preferredTechniques: string[];
    cookingPhilosophy: string | null;
  };
  skillLevel: string;
  equipment: string[];
  targetCuisine?: string;
  count: number;
  existingTitles: string[];
  /** When set: one recipe per pair; each must star both ingredients (non-optional). */
  pantryBridgePairs?: Array<{ nameA: string; nameB: string }>;
  /** Pantry bridge: minimum distinct matched ingredients per recipe (focal pair included). */
  bridgeMinDistinctIngredients?: number;
  /** Cookbook graph hubs (names) — bridge recipes should cross-link through these when possible. */
  networkHubIngredientNames?: string[];
  /** Second pass: mesh-only batch (no prescribed pairs); densifies hub ↔ pantry co-occurrence. */
  networkMeshMode?: boolean;
  /** NEW_INGREDIENTS mode: names of newly-added ingredients that lack recipe coverage. */
  focusIngredientNames?: string[];
}): { system: string; user: string } {
  const bridgeMode = (context.pantryBridgePairs?.length ?? 0) > 0;
  const meshMode = Boolean(context.networkMeshMode) && !bridgeMode;
  const bridgeMin =
    context.bridgeMinDistinctIngredients ??
    Math.min(
      Math.max(3, Math.min(8, context.ingredients.length)),
      Math.max(1, context.ingredients.length),
    );
  const hubList = context.networkHubIngredientNames ?? [];
  const bridgeBlock = bridgeMode
    ? `
14. PANTRY BRIDGE MODE: You must output exactly ${context.count} recipes — one dedicated recipe per line in PANTRY PAIRS below.
15. For each pair, that recipe MUST include BOTH named ingredients as required (non-optional) focal ingredients featured in the title or description.
16. Do not combine two pairs into one recipe; do not omit a pair.
17. You may add other ingredients from AVAILABLE INGREDIENTS freely to complete the dish.
18. NETWORK MESH: Each recipe must list at least ${bridgeMin} distinct ingredients from AVAILABLE INGREDIENTS (the two focal names count toward this). Use items from at least 2 different categories in that list so the dish ties into the broader pantry, not an isolated pair.
19. ${
        hubList.length >= 2
          ? `HUB INGREDIENTS — these are the most network-connected items already in the chef's cookbook. Include at least 2 of the following by exact name as required (non-optional) lines when they appear in AVAILABLE INGREDIENTS:\n${hubList.slice(0, 28).map((n) => `- ${n}`).join("\n")}`
          : "The cookbook graph is still sparse — still build complete plates using as many distinct stocked ingredients as make sense (respecting the minimum above)."
      }
20. Each recipe should read as a full dish the chef would cook again; ingredients you add should plausibly strengthen co-occurrence across their pantry and cookbook, not one-off oddities.
`
    : "";

  const focusMode =
    !bridgeMode &&
    !meshMode &&
    (context.focusIngredientNames?.length ?? 0) > 0;
  const focusNames = context.focusIngredientNames ?? [];

  const newIngredientsBlock = focusMode
    ? `
14. NEW INGREDIENT COVERAGE MODE — the chef just added fresh ingredients to their pantry. Your primary goal is to give every FOCUS INGREDIENT at least one recipe where it plays a meaningful role (not a garnish).

FRAMEWORK — follow this reasoning chain internally before writing each recipe:
  a) Pick the next uncovered FOCUS INGREDIENT as the ANCHOR.
  b) FLAVOR AFFINITY: Identify which AVAILABLE INGREDIENTS complement the anchor (e.g., acid balances fat, umami deepens protein, aromatics lift starch).
  c) CATEGORY PAIRING: Combine at least 2 different ingredient categories (e.g., protein + vegetable + grain) so the recipe is a complete plate.
  d) TECHNIQUE FIT: Choose a technique the chef is comfortable with (see CHEF PROFILE) that best suits the anchor ingredient.
  e) CUISINE ALIGNMENT: Lean toward the chef's primary cuisines when the anchor naturally fits; use FUSION or OTHER only when a cross-cuisine pairing is genuinely stronger.
  f) Assemble a recipe where the anchor is a REQUIRED (non-optional) ingredient featured in the title or description.

15. COVERAGE RULES:
  - Every FOCUS INGREDIENT must appear as required (non-optional) in at least one recipe.
  - Each recipe must use at least 3 distinct ingredients from AVAILABLE INGREDIENTS.
  - A recipe MAY cover multiple FOCUS INGREDIENTS if they pair naturally — but do not force awkward combinations just to cover them faster.
  - Spread recipes across different cuisines and techniques when possible to keep the cookbook diverse.

16. ANTI-PATTERNS — avoid these:
  - Do not relegate a focus ingredient to an optional garnish or "to taste" afterthought.
  - Do not generate a recipe that is essentially "ingredient + salt + heat" — build real dishes with complementary flavors and textures.
  - Do not cluster all recipes into the same cuisine or technique.
`
    : "";

  const meshMin =
    context.bridgeMinDistinctIngredients ??
    Math.min(
      Math.max(5, Math.min(8, context.ingredients.length)),
      Math.max(1, context.ingredients.length),
    );

  const meshBlock = meshMode
    ? `
14. NETWORK MESH PASS (no prescribed ingredient pairs): Each recipe intentionally weaves together multiple stocked items so they co-occur in the chef's cookbook graph — think complete plates, not minimal sketches.
15. Each recipe MUST list at least ${meshMin} distinct ingredients from AVAILABLE INGREDIENTS as required (non-optional), drawn from at least 3 different categories in that list.
16. ${
        hubList.length >= 2
          ? `HUB INGREDIENTS — include at least 3 of the following by exact name as required lines when they appear in AVAILABLE INGREDIENTS (these are the most connected nodes in the existing graph):\n${hubList.slice(0, 28).map((n) => `- ${n}`).join("\n")}`
          : "Use as many distinct stocked categories as make sense for a credible dish."
      }
17. Recipes must be clearly distinct: different dominant protein or starch, different cuisine accent, or different primary technique — avoid near-duplicates.
`
    : "";

  const system = `ROLE: You are the recipe JSON engine inside Chef Bentley's Kitchen ERP. Your output is parsed by strict software — not read for prose quality. Audience: intermediate–professional cooks.

OUTPUT: Exactly one JSON object: {"recipes":[ ... ]} with length ${context.count}. No markdown fences, no preamble, no postscript.

COMPUTE / TOKEN DISCIPLINE: Use the minimum text that remains unambiguous. description: max 2 short sentences. Each instructions[].step: one clear imperative sentence (two only if safety or timing demands it). Omit filler adjectives. Put quantities only in ingredients[], not repeated in steps.

RULES:
1. ingredientName must exactly match a name from AVAILABLE INGREDIENTS (user message).
2. Honor chef skill, style, and equipment from the user message — calibrate difficulty and methods accordingly.
3. instructions[].technique must be exactly one of: ${VALID_TECHNIQUES.join(", ")}
4. cuisine must be exactly one of: ${VALID_CUISINES.join(", ")}
5. techniques[] = deduplicated list of techniques used across steps.
6. Do not reuse any title from EXISTING RECIPE TITLES.
7. difficulty integer 2–5; prepTime and cookTime integers (minutes); servings integer ≥1.
8. flavorTags: integers 0–10 for keys spicy, sweet, umami, acidic, rich, light.
9. tags: short lowercase hooks (e.g. comfort, weeknight, meal-prep, one-pot).
10. Recipes must differ meaningfully (protein/starch, cuisine lean, or primary technique).${newIngredientsBlock}${bridgeBlock}${meshBlock}

EACH recipes[] ELEMENT SCHEMA:
{
  "title": string,
  "description": string,
  "cuisine": string,
  "difficulty": number,
  "techniques": string[],
  "ingredients": [{ "ingredientName": string, "quantity": number, "unit": string, "isOptional": boolean, "prepNote": string | undefined }],
  "instructions": [{ "step": string, "technique": string, "timing": string | undefined, "notes": string | undefined }],
  "prepTime": number,
  "cookTime": number,
  "servings": number,
  "flavorTags": object,
  "tags": string[]
}`;

  const cuisineDirective = context.targetCuisine
    ? `\nFOCUS: Generate recipes primarily in ${formatEnum(context.targetCuisine)} cuisine.`
    : "";

  const philosophyLine = context.cookingStyle.cookingPhilosophy
    ? `- Cooking Philosophy: ${context.cookingStyle.cookingPhilosophy}`
    : "";

  const user = `Task: emit ${context.count} recipes in the JSON object.${cuisineDirective}

CHEF PROFILE:
- Skill Level: ${formatEnum(context.skillLevel)}
- Primary Cuisines: ${context.cookingStyle.primaryCuisines.map(formatEnum).join(", ") || "Eclectic — no strong preference"}
- Preferred Techniques: ${context.cookingStyle.preferredTechniques.map(formatEnum).join(", ") || "Open to all techniques"}${philosophyLine ? "\n" + philosophyLine : ""}

AVAILABLE EQUIPMENT:
${context.equipment.length > 0 ? context.equipment.join(", ") : "Standard home kitchen (oven, stovetop, basic pots/pans, blender, food processor)"}

AVAILABLE INGREDIENTS:
${groupByCategory(context.ingredients)}

${
  context.existingTitles.length > 0
    ? `EXISTING RECIPE TITLES (do NOT duplicate these):\n${context.existingTitles.map((t) => `- ${t}`).join("\n")}`
    : "No existing recipes — this is the chef's first batch."
}${
    bridgeMode && context.pantryBridgePairs
      ? `\n\nPANTRY PAIRS (one new recipe per line — both ingredients required in that recipe):\n${context.pantryBridgePairs.map((p, i) => `${i + 1}. "${p.nameA}" + "${p.nameB}"`).join("\n")}`
      : ""
  }${
    focusMode && focusNames.length > 0
      ? `\n\nFOCUS INGREDIENTS (newly added — each must appear as required in at least one recipe):\n${focusNames.map((n) => `- ${n}`).join("\n")}`
      : ""
  }${
    bridgeMode && hubList.length >= 2
      ? `\n\nCOOKBOOK NETWORK HUBS (cross-link each bridge recipe through the established graph — exact names):\n${hubList.slice(0, 24).join(", ")}`
      : ""
  }${
    meshMode && hubList.length >= 2
      ? `\n\nCOOKBOOK NETWORK HUBS (mesh pass — anchor each recipe in the graph backbone; exact names):\n${hubList.slice(0, 24).join(", ")}`
      : ""
  }`;

  return { system, user };
}

export function buildSingleRecipePrompt(context: {
  ingredients: Array<{ id: string; name: string }>;
  request: string;
  cookingStyle: {
    primaryCuisines: string[];
    preferredTechniques: string[];
  };
  skillLevel: string;
  equipment: string[];
}): { system: string; user: string } {
  const system = `ROLE: Single-recipe JSON engine for Chef Bentley's Kitchen ERP. Output one JSON object only (not wrapped in "recipes"). Parsed automatically — no markdown, no extra text.

EFFICIENCY: Tight description (≤2 short sentences). One imperative sentence per instruction step unless split is necessary.

RULES:
1. ingredientName values only from AVAILABLE INGREDIENTS; exact spelling.
2. instructions[].technique must be one of: ${VALID_TECHNIQUES.join(", ")}
3. cuisine must be one of: ${VALID_CUISINES.join(", ")}
4. difficulty 1–5; techniques[] deduped from steps.
5. Practical for same-day cooking with listed pantry.

SCHEMA:
{
  "title": string,
  "description": string,
  "cuisine": string,
  "difficulty": number,
  "techniques": string[],
  "ingredients": [{ "ingredientName": string, "quantity": number, "unit": string, "isOptional": boolean, "prepNote": string | undefined }],
  "instructions": [{ "step": string, "technique": string, "timing": string | undefined, "notes": string | undefined }],
  "prepTime": number,
  "cookTime": number,
  "servings": number,
  "flavorTags": { "spicy": 0-10, "sweet": 0-10, "umami": 0-10, "acidic": 0-10, "rich": 0-10, "light": 0-10 },
  "tags": string[]
}`;

  const user = `REQUEST: ${context.request}

CHEF PROFILE:
- Skill Level: ${formatEnum(context.skillLevel)}
- Primary Cuisines: ${context.cookingStyle.primaryCuisines.map(formatEnum).join(", ") || "Eclectic"}
- Preferred Techniques: ${context.cookingStyle.preferredTechniques.map(formatEnum).join(", ") || "Open to all"}

AVAILABLE EQUIPMENT:
${context.equipment.length > 0 ? context.equipment.join(", ") : "Standard home kitchen"}

AVAILABLE INGREDIENTS:
${context.ingredients.map((i) => i.name).join(", ")}`;

  return { system, user };
}
