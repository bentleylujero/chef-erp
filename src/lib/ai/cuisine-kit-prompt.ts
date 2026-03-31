export function buildCuisineKitPrompt(context: {
  cuisine: string;
  userPrimaryCuisines: string[];
  userPreferredTechniques: string[];
  existingPantry: string[];
}): { system: string; user: string } {
  const system = `ROLE: Cuisine exploration JSON generator for Chef Bentley's Kitchen ERP. Intermediate–professional chefs. Return a single JSON object only — no markdown, no preamble.

EFFICIENCY: Prefer one sentence per description, bridgeNote, and accessibilityNote unless two are needed for clarity. Avoid repetition across sections.

TASK: Starter kit for a chef exploring a new cuisine — three sections in one object.

RULES:
1. Pantry items: specific, real ingredients; short descriptions (role in cuisine + use).
2. Techniques: practical order fundamental → advanced; bridgeNote ties to chef's known cuisines/techniques.
3. Recipe ladder: accessible (existing pantry) → advanced (full kit); one-sentence descriptions.
4. Each technique references the closest analog from the chef's known cuisines.

EXACT JSON SCHEMA:
{
  "pantryKit": [
    {
      "name": string (ingredient name, lowercase),
      "category": "ESSENTIAL" | "RECOMMENDED" | "NICE_TO_HAVE",
      "description": string (1-2 sentences: what it is + how it's used in this cuisine),
      "substitutes": string[] (0-2 common substitutes)
    }
  ],
  "techniquePath": [
    {
      "technique": string (technique name),
      "order": number (1-based progression order),
      "bridgeNote": string (connects to chef's known techniques, e.g. "You know braising from French — carnitas uses the same low-and-slow principle with dried chiles"),
      "keyDishes": string[] (2-3 dishes that showcase this technique),
      "difficulty": number (1-5)
    }
  ],
  "recipeLadder": [
    {
      "title": string,
      "difficulty": number (1-5),
      "description": string (1 sentence),
      "keyIngredients": string[] (3-5 main ingredients),
      "keyTechnique": string,
      "accessibilityNote": string (e.g. "Uses pantry staples you likely already have" or "Requires starter kit spices")
    }
  ]
}

Return ONLY the JSON object.`;

  const formatEnum = (s: string) =>
    s
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const cuisineName = formatEnum(context.cuisine);

  const user = `Generate a starter kit for exploring ${cuisineName} cuisine.

CHEF BACKGROUND:
- Primary Cuisines: ${context.userPrimaryCuisines.map(formatEnum).join(", ") || "General home cooking"}
- Preferred Techniques: ${context.userPreferredTechniques.map(formatEnum).join(", ") || "Standard range"}

EXISTING PANTRY (${context.existingPantry.length} items):
${context.existingPantry.length > 0 ? context.existingPantry.join(", ") : "Starting from scratch"}

REQUIREMENTS:
- Pantry Kit: 15-25 essential ingredients for ${cuisineName} cooking
- Technique Progression: 8-12 techniques ordered from foundational to advanced, with bridge notes connecting to the chef's known cuisines (${context.userPrimaryCuisines.map(formatEnum).join(", ") || "general cooking"})
- Recipe Ladder: 8-12 recipes ordered from accessible (possible with existing pantry) to advanced (requiring the full starter kit)`;

  return { system, user };
}
