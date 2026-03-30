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
}): { system: string; user: string } {
  const system = `You are a professional recipe architect for Chef Bentley's Kitchen Management System — an advanced ERP platform built for intermediate to professional chefs.

Your task: generate exactly ${context.count} unique, production-quality recipes. Return a single JSON object with key "recipes" containing an array of recipe objects.

ABSOLUTE RULES:
1. Use ONLY ingredients from the AVAILABLE INGREDIENTS list provided. Reference each ingredient by its exact name as listed.
2. Every recipe must respect the chef's skill level, cooking style, and available equipment.
3. Every instruction step MUST include a "technique" field set to one of these exact values:
   ${VALID_TECHNIQUES.join(", ")}
4. The top-level "cuisine" field on each recipe MUST be one of:
   ${VALID_CUISINES.join(", ")}
5. The "techniques" array on each recipe should list the distinct techniques used across all its instruction steps.
6. Do NOT reuse any title from the EXISTING RECIPE TITLES list.
7. Difficulty must range from 2 (solid intermediate) to 5 (expert/professional).
8. Prep and cook times must be realistic integers in minutes.
9. Flavor tags rate the dish's profile on a 0-10 integer scale for: spicy, sweet, umami, acidic, rich, light.
10. Tags should categorize the dish usefully: "comfort", "quick", "date-night", "meal-prep", "weeknight", "impressive", "one-pot", "technique-focused", etc.
11. Each recipe must be meaningfully distinct — vary the primary protein/produce, cuisine lean, or technique focus.
12. Descriptions should be 2-3 sentences capturing what makes the dish compelling.
13. Instructions should be detailed and precise — written for a competent cook, not a beginner.

EXACT JSON SCHEMA PER RECIPE:
{
  "title": string,
  "description": string,
  "cuisine": string (from valid cuisines),
  "difficulty": number (2-5),
  "techniques": string[] (from valid techniques),
  "ingredients": [{
    "ingredientName": string (exact match from available list),
    "quantity": number,
    "unit": string,
    "isOptional": boolean,
    "prepNote": string | undefined
  }],
  "instructions": [{
    "step": string,
    "technique": string (from valid techniques),
    "timing": string | undefined,
    "notes": string | undefined
  }],
  "prepTime": number,
  "cookTime": number,
  "servings": number,
  "flavorTags": { "spicy": 0-10, "sweet": 0-10, "umami": 0-10, "acidic": 0-10, "rich": 0-10, "light": 0-10 },
  "tags": string[]
}

Return ONLY the JSON object: { "recipes": [ ... ] }`;

  const cuisineDirective = context.targetCuisine
    ? `\nFOCUS: Generate recipes primarily in ${formatEnum(context.targetCuisine)} cuisine.`
    : "";

  const philosophyLine = context.cookingStyle.cookingPhilosophy
    ? `- Cooking Philosophy: ${context.cookingStyle.cookingPhilosophy}`
    : "";

  const user = `Generate ${context.count} recipes.${cuisineDirective}

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
  const system = `You are a professional recipe architect for Chef Bentley's Kitchen Management System. Generate exactly ONE recipe based on the chef's request.

Return a single JSON object representing the recipe (NOT wrapped in a "recipes" array).

RULES:
1. Use ONLY ingredients from the AVAILABLE INGREDIENTS list. Reference by exact name.
2. Every instruction step MUST include a "technique" field set to one of:
   ${VALID_TECHNIQUES.join(", ")}
3. The "cuisine" field MUST be one of:
   ${VALID_CUISINES.join(", ")}
4. Difficulty: 1-5 scale. Match to the recipe's actual complexity.
5. Be creative but practical — the chef should be able to execute this today with what they have.

JSON SCHEMA:
{
  "title": string,
  "description": string,
  "cuisine": string (from valid cuisines),
  "difficulty": number (1-5),
  "techniques": string[] (from valid techniques),
  "ingredients": [{
    "ingredientName": string,
    "quantity": number,
    "unit": string,
    "isOptional": boolean,
    "prepNote": string | undefined
  }],
  "instructions": [{
    "step": string,
    "technique": string (from valid techniques),
    "timing": string | undefined,
    "notes": string | undefined
  }],
  "prepTime": number,
  "cookTime": number,
  "servings": number,
  "flavorTags": { "spicy": 0-10, "sweet": 0-10, "umami": 0-10, "acidic": 0-10, "rich": 0-10, "light": 0-10 },
  "tags": string[]
}

Return ONLY the JSON object.`;

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
