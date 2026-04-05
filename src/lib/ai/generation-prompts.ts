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
  ingredients: Array<{
    id: string;
    name: string;
    category: string;
    catalogTier?: string;
  }>;
  cookingStyle: {
    primaryCuisines: string[];
    exploringCuisines?: string[];
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
  /** RAG context: similar recipes from the cookbook embedding index (injected pre-generation). */
  ragContext?: string;
  /** COOKBOOK_BUILD mode: mass generation with 90/10 rule. */
  cookbookBuildMode?: boolean;
  /** Allowed cuisines whitelist (from user's primary + exploring). */
  allowedCuisines?: string[];
  /** EXPIRY_RESCUE mode: names of ingredients expiring within 2-3 days. */
  expiringIngredientNames?: string[];
  /** PREFERENCE_DRIFT mode: flavor dimensions where user prefs diverge from cookbook avg. */
  driftedDimensions?: Array<{
    dimension: string;
    userValue: number;
    cookbookAvg: number;
  }>;
}): { system: string; user: string } {
  const bridgeMode = (context.pantryBridgePairs?.length ?? 0) > 0;
  const meshMode = Boolean(context.networkMeshMode) && !bridgeMode;
  const cookbookBuild = Boolean(context.cookbookBuildMode);
  const bridgeMin =
    context.bridgeMinDistinctIngredients ??
    Math.min(
      Math.max(3, Math.min(8, context.ingredients.length)),
      Math.max(1, context.ingredients.length),
    );
  const hubList = context.networkHubIngredientNames ?? [];

  // ── CUISINE WHITELIST ──
  const allCuisines = [
    ...(context.cookingStyle.primaryCuisines ?? []),
    ...(context.cookingStyle.exploringCuisines ?? []),
  ];
  const allowedCuisines = context.allowedCuisines?.length
    ? context.allowedCuisines
    : allCuisines.length > 0
      ? allCuisines
      : null; // null = no restriction (fallback for users with no cuisine prefs)

  const cuisineRestriction = allowedCuisines
    ? `\nCUISINE RESTRICTION: ONLY generate recipes in these cuisines: ${allowedCuisines.map(formatEnum).join(", ")}. Do NOT use any cuisine outside this list. Every recipe's "cuisine" field MUST be one of these.`
    : "";

  // ── COOKING PHILOSOPHY ──
  const philosophy = context.cookingStyle.cookingPhilosophy;
  const philosophyBlock = philosophy
    ? `\nCOOKING PHILOSOPHY (HARD CONSTRAINT): Every recipe MUST align with this philosophy: "${philosophy}". If a recipe concept conflicts with this philosophy, discard it and generate one that fits. This is non-negotiable — the chef's identity and values drive the entire cookbook.`
    : "";

  // ── 90/10 RULE (COOKBOOK BUILD MODE) ──
  const pantryOnlyCount = cookbookBuild
    ? Math.ceil(context.count * 0.9)
    : context.count;
  const substituteCount = cookbookBuild
    ? context.count - pantryOnlyCount
    : 0;

  const ninetyTenBlock = cookbookBuild
    ? `
90/10 INGREDIENT RULE:
- The first ${pantryOnlyCount} recipes (indices 0–${pantryOnlyCount - 1}) are PANTRY-ONLY: every ingredient MUST come from AVAILABLE INGREDIENTS exactly.
- The remaining ${substituteCount} recipe(s) (indices ${pantryOnlyCount}–${context.count - 1}) may include UP TO 2 ingredients NOT in the pantry, BUT each non-pantry ingredient MUST have a "substituteFor" field naming the ideal ingredient, and the "ingredientName" MUST be an AVAILABLE INGREDIENT that works as a reasonable swap.
  Example: if the recipe ideally uses "Fresh Mozzarella" but the chef has "Ricotta", output: { "ingredientName": "Ricotta", "substituteFor": "Fresh Mozzarella", ... }
- This means ALL ${context.count} recipes are cookable from the pantry — the substitute recipes just note what the "dream" ingredient would be.
- The substitute recipes should push the chef slightly outside their comfort zone — more ambitious plating, a technique twist, or a fusion angle — while remaining achievable with pantry swaps.
`
    : "";

  // ── BRIDGE BLOCK ──
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

  // ── FOCUS (NEW INGREDIENTS) BLOCK ──
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

  // ── MESH BLOCK ──
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

  // ── COOKBOOK BUILD BLOCK ──
  const cookbookBuildBlock = cookbookBuild
    ? `
14. COOKBOOK BUILD MODE — you are generating a large, diverse cookbook section. This is NOT a small batch — you must produce ${context.count} meaningfully different recipes. MAXIMIZE RECIPE COUNT: explore every plausible combination of the available ingredients. Think in terms of ingredient ROLE SWAPS (same protein grilled vs. braised vs. stewed), CUISINE PIVOTS (same vegetables in French vs. Mexican vs. Italian preparations), and MEAL TYPE SHIFTS (the same core ingredients as a salad, soup, main, or side).

CREATIVE GENERATION FRAMEWORK — for each recipe, internally ask:
  a) What ANCHOR ingredient haven't I featured yet (or haven't used in this cuisine)?
  b) What SUPPORTING ingredients create a different flavor profile than my previous recipes?
  c) What TECHNIQUE haven't I used recently?
  d) What MEAL TYPE is underrepresented so far?

DIVERSITY REQUIREMENTS:
  a) SPREAD ACROSS MEAL TYPES: Include a mix of breakfasts, lunches, dinners, snacks, and sides. Not all dinner entrees.
  b) DIFFICULTY RANGE: Include easy weeknight meals (difficulty 2-3), medium-effort dishes (3-4), and ambitious weekend projects (4-5). Weight toward 2-3 for everyday cooking.
  c) TECHNIQUE VARIETY: Use at least 6 different primary techniques across the batch. Don't default to sauté for everything.
  d) INGREDIENT ROTATION: Every pantry ingredient should appear in at least 1 recipe. No ingredient should dominate more than 15% of recipes. Rotate proteins, starches, and vegetables deliberately.
  e) TIME VARIETY: Include quick meals (under 30 min total), medium (30-60 min), and longer projects (60+ min).
  f) SERVING VARIETY: Mix single-serving, couple (2), family (4), and batch/meal-prep (6-8) sizes.
  g) COMBINATION MINING: For N pantry ingredients, there are exponentially many valid combinations. Push beyond the obvious — a pantry with chicken, rice, peppers, and onions can make stir-fry, arroz con pollo, stuffed peppers, chicken soup, fried rice, fajitas, and more. Find those combinations.

15. ANTI-STALENESS: No two recipes should share more than 70% of their ingredients. If you notice repetition, pivot to a different cuisine, technique, or protein anchor.

16. ${ninetyTenBlock}
`
    : "";

  // ── EXPIRY RESCUE BLOCK ──
  const expiryMode =
    !bridgeMode &&
    !meshMode &&
    !cookbookBuild &&
    (context.expiringIngredientNames?.length ?? 0) > 0;
  const expiryNames = context.expiringIngredientNames ?? [];

  const expiryRescueBlock = expiryMode
    ? `
14. EXPIRY RESCUE MODE — the following ingredients are expiring within 1-2 days and MUST be used up. This is the chef's top priority.

EXPIRING INGREDIENTS (use these FIRST):
${expiryNames.map((n) => `- ${n}`).join("\n")}

RULES:
  - Every EXPIRING INGREDIENT must appear as REQUIRED (non-optional) in at least one recipe.
  - Each recipe should feature at least one expiring ingredient as a PRIMARY component (not a garnish).
  - Prioritize recipes that use MULTIPLE expiring ingredients together when they pair well.
  - Keep recipes quick and practical (prefer difficulty 2-3, total time under 45 min) — the chef needs to cook these soon.
  - Tag every recipe with "expiry-rescue" in the tags array.
  - You may add other AVAILABLE INGREDIENTS to complete the dish, but expiring items drive the recipe design.
`
    : "";

  // ── PREFERENCE DRIFT BLOCK ──
  const driftMode =
    !bridgeMode &&
    !meshMode &&
    !cookbookBuild &&
    !expiryMode &&
    (context.driftedDimensions?.length ?? 0) > 0;
  const driftDims = context.driftedDimensions ?? [];

  const preferenceDriftBlock = driftMode
    ? `
14. PREFERENCE DRIFT MODE — the chef's flavor preferences have shifted away from what the cookbook currently offers. Generate recipes that close this gap.

DRIFTED DIMENSIONS:
${driftDims.map((d) => `- ${formatEnum(d.dimension)}: chef prefers ${d.userValue}/10, cookbook average is ${d.cookbookAvg.toFixed(1)}/10 (${d.userValue > d.cookbookAvg ? "needs MORE" : "needs LESS"})`).join("\n")}

RULES:
  - Each recipe's flavorTags MUST reflect the chef's actual preferences, not the cookbook average.
${driftDims.map((d) => `  - Set "${d.dimension}" flavorTag to ${Math.round(d.userValue)} (or close) — ${d.userValue > d.cookbookAvg ? "push this dimension UP" : "pull this dimension DOWN"}.`).join("\n")}
  - Recipes should feel natural and delicious, not artificially skewed — find dishes where these flavor levels occur organically.
  - Tag every recipe with "preference-drift" in the tags array.
  - Spread across different cuisines and techniques for variety.
`
    : "";

  const system = `ROLE: You are the recipe JSON engine inside Chef Bentley's Kitchen ERP. Your output is parsed by strict software — not read for prose quality. Audience: intermediate–professional cooks.

OUTPUT: Exactly one JSON object: {"recipes":[ ... ]} with length ${context.count}. No markdown fences, no preamble, no postscript.

INSTRUCTION QUALITY: Write directions a professional cook would respect.
- description: 2–3 vivid sentences that sell the dish — mention the dominant flavor profile, key technique, and what makes it satisfying.
- Each instructions[].step: 2–3 sentences. Lead with the action, then explain WHAT TO LOOK FOR (visual/aural/textural cue) and WHY (the culinary reason). Example: "Sear the chicken skin-side down without moving it. Wait for the skin to turn deep golden and release naturally from the pan — this builds the fond that flavors the sauce. About 4–5 minutes."
- Include technique-specific cues: color changes, aromas, textures, sounds (sizzle fading = moisture gone, etc.).
- Put quantities only in ingredients[], not repeated in steps. But DO reference timing, temperature, and doneness indicators in steps.
- Vary sentence structure — do not start every step with the same pattern.

RULES:
1. ingredientName must exactly match a name from AVAILABLE INGREDIENTS (user message) — same spelling and capitalization as listed.
2. Honor chef skill, style, and equipment from the user message — calibrate difficulty and methods accordingly.
3. instructions[].technique must be exactly one of: ${VALID_TECHNIQUES.join(", ")}
4. cuisine must be exactly one of: ${allowedCuisines ? allowedCuisines.join(", ") : VALID_CUISINES.join(", ")}
5. techniques[] = deduplicated list of techniques used across steps.
6. Do not reuse any title from EXISTING RECIPE TITLES.
7. difficulty integer 2–5; prepTime and cookTime integers (minutes); servings integer ≥1.
8. flavorTags: integers 0–10 for keys spicy, sweet, umami, acidic, rich, light.
9. tags: short lowercase hooks (e.g. comfort, weeknight, meal-prep, one-pot, breakfast, lunch, dinner, snack, side, appetizer, date-night, batch-cook).
10. Recipes must differ meaningfully (protein/starch, cuisine lean, or primary technique).
11. PANTRY-ONLY (unless 90/10 rule applies): The chef has ONLY the items under AVAILABLE INGREDIENTS. Every ingredients[].ingredientName MUST be copied exactly from that list. Never invent or imply items they do not stock.
12. TITLE, DESCRIPTION, and every instructions[].step: do not name any food, herb, spice, protein, vegetable, starch, noodle shape, or cheese unless that exact name (as listed in AVAILABLE INGREDIENTS) appears in this recipe's ingredients[] array. Wrong: "Tomato Basil Rigatoni" without a Basil line matching the pantry list. Right: names that only reflect ingredients you actually listed (e.g. if the pantry lists "Oregano" not "Basil", say oregano or stay generic).
13. The finished recipe must be honestly cookable from ingredients[] alone — no "pantry staples" or unlisted assumptions.${philosophyBlock}${cuisineRestriction}${newIngredientsBlock}${bridgeBlock}${meshBlock}${cookbookBuildBlock}${expiryRescueBlock}${preferenceDriftBlock}

EACH recipes[] ELEMENT SCHEMA:
{
  "title": string,
  "description": string,
  "cuisine": string,
  "difficulty": number,
  "techniques": string[],
  "ingredients": [{ "ingredientName": string, "quantity": number, "unit": string, "isOptional": boolean, "prepNote": string | undefined, "substituteFor": string | undefined }],
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

  const adHocNames = context.ingredients
    .filter((i) => i.catalogTier === "USER_AD_HOC")
    .map((i) => i.name);
  const catalogTierNote =
    adHocNames.length > 0
      ? `\nCATALOG NOTE: Names below are the canonical strings you must use in ingredientName. Items only in this list as user-added (USER_AD_HOC) are: ${adHocNames.join(", ")}. Prefer treating SYSTEM-style naming as the mental model for flavor pairing, but never invent a different spelling than the listed name.`
      : "";

  const philosophyLine = context.cookingStyle.cookingPhilosophy
    ? `- Cooking Philosophy: ${context.cookingStyle.cookingPhilosophy}`
    : "";

  const exploringLine =
    (context.cookingStyle.exploringCuisines?.length ?? 0) > 0
      ? `\n- Exploring Cuisines: ${context.cookingStyle.exploringCuisines!.map(formatEnum).join(", ")}`
      : "";

  const user = `Task: emit ${context.count} recipes in the JSON object.${cuisineDirective}

CHEF PROFILE:
- Skill Level: ${formatEnum(context.skillLevel)}
- Primary Cuisines: ${context.cookingStyle.primaryCuisines.map(formatEnum).join(", ") || "Eclectic — no strong preference"}${exploringLine}
- Preferred Techniques: ${context.cookingStyle.preferredTechniques.map(formatEnum).join(", ") || "Open to all techniques"}${philosophyLine ? "\n" + philosophyLine : ""}

AVAILABLE EQUIPMENT:
${context.equipment.length > 0 ? context.equipment.join(", ") : "Standard home kitchen (oven, stovetop, basic pots/pans, blender, food processor)"}

AVAILABLE INGREDIENTS (this is the complete, exclusive list — nothing else exists in the kitchen):
${groupByCategory(context.ingredients)}${catalogTierNote}

${
  context.existingTitles.length > 0
    ? `EXISTING RECIPE TITLES (do NOT duplicate these):\n${context.existingTitles.map((t) => `- ${t}`).join("\n")}`
    : "No existing recipes — this is the chef's first batch."
}${
    context.ragContext
      ? `\n\nRELATED COOKBOOK RECIPES (for inspiration — do not duplicate, but use as flavor/technique reference):\n${context.ragContext}`
      : ""
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
  }${
    expiryMode && expiryNames.length > 0
      ? `\n\nEXPIRING SOON (must be used as required ingredients — these expire in 1-2 days):\n${expiryNames.map((n) => `- ${n}`).join("\n")}`
      : ""
  }${
    driftMode && driftDims.length > 0
      ? `\n\nFLAVOR DRIFT TARGETS (generate recipes that match these preference levels):\n${driftDims.map((d) => `- ${formatEnum(d.dimension)}: target ${d.userValue}/10 (cookbook currently averages ${d.cookbookAvg.toFixed(1)})`).join("\n")}`
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
1. ingredientName values only from AVAILABLE INGREDIENTS; exact spelling as listed.
2. instructions[].technique must be one of: ${VALID_TECHNIQUES.join(", ")}
3. cuisine must be one of: ${VALID_CUISINES.join(", ")}
4. difficulty 1–5; techniques[] deduped from steps.
5. Practical for same-day cooking with listed pantry only — no unlisted foods in title, description, or steps.
6. Title and description must not name any ingredient not present in ingredients[] with the exact AVAILABLE name.

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
