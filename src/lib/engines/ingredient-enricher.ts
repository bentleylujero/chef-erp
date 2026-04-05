import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { openai, OPENAI_MODEL_JSON } from "@/lib/openai";
import type { Cuisine, IngredientCategory } from "@prisma/client";

const VALID_CATEGORIES = new Set<string>([
  "POULTRY", "RED_MEAT", "SEAFOOD", "CURED_DELI", "VEGETABLE", "FRUIT",
  "AROMATIC", "MUSHROOM", "DAIRY", "CHEESE", "CONDIMENT", "SAUCE", "PASTE",
  "VINEGAR", "PANTRY_STAPLE", "SPICE", "GRAIN", "LEGUME", "OIL_FAT", "HERB",
  "NUT_SEED", "SWEETENER", "BEVERAGE", "BAKING", "OTHER",
]);

const VALID_CUISINES = new Set<string>([
  "FRENCH", "ITALIAN", "DELI", "MEXICAN", "MEDITERRANEAN", "JAPANESE", "THAI",
  "KOREAN", "CHINESE", "INDIAN", "AMERICAN", "MIDDLE_EASTERN", "AFRICAN",
  "CARIBBEAN", "SOUTHEAST_ASIAN", "FUSION", "OTHER",
]);

const enrichmentSchema = z.object({
  category: z.string(),
  flavorTags: z.object({
    spicy: z.number().min(0).max(10),
    sweet: z.number().min(0).max(10),
    umami: z.number().min(0).max(10),
    acidic: z.number().min(0).max(10),
    rich: z.number().min(0).max(10),
    light: z.number().min(0).max(10),
  }),
  cuisineTags: z.array(z.string()),
  description: z.string(),
  shelfLifeDays: z.number().int().positive().nullable(),
  avgPricePerUnit: z.number().positive().nullable(),
});

export interface EnrichmentResult {
  ingredientId: string;
  enriched: boolean;
  category: IngredientCategory;
  flavorTags: Record<string, number>;
  cuisineTags: Cuisine[];
  description: string;
}

export function needsEnrichment(ingredient: {
  flavorTags: unknown;
  cuisineTags: unknown[];
  category: string;
}): boolean {
  const tags = ingredient.flavorTags as Record<string, number> | null;
  const isEmpty = !tags || Object.keys(tags).length === 0;
  return isEmpty && ingredient.cuisineTags.length === 0;
}

function buildEnrichmentPrompt(
  name: string,
  currentCategory: string,
): { system: string; user: string } {
  return {
    system: `You are a culinary ingredient classifier. Return ONLY valid JSON with no markdown.

Schema:
{
  "category": one of: ${[...VALID_CATEGORIES].join(", ")},
  "flavorTags": { "spicy": 0-10, "sweet": 0-10, "umami": 0-10, "acidic": 0-10, "rich": 0-10, "light": 0-10 },
  "cuisineTags": array of: ${[...VALID_CUISINES].join(", ")},
  "description": one sentence describing culinary use,
  "shelfLifeDays": integer or null if indefinite,
  "avgPricePerUnit": USD per gram/ml/count (best estimate) or null
}`,
    user: `Classify this ingredient: "${name}" (current category: ${currentCategory})`,
  };
}

export async function enrichNewIngredient(
  ingredientId: string,
): Promise<EnrichmentResult> {
  const ingredient = await prisma.ingredient.findUniqueOrThrow({
    where: { id: ingredientId },
    select: { name: true, category: true, flavorTags: true, cuisineTags: true },
  });

  if (!needsEnrichment(ingredient)) {
    return {
      ingredientId,
      enriched: false,
      category: ingredient.category,
      flavorTags: ingredient.flavorTags as Record<string, number>,
      cuisineTags: ingredient.cuisineTags,
      description: "",
    };
  }

  const prompt = buildEnrichmentPrompt(ingredient.name, ingredient.category);

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL_JSON,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 300,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(`Empty enrichment response for ${ingredient.name}`);

  const raw = JSON.parse(content);
  const parsed = enrichmentSchema.parse(raw);

  const category = VALID_CATEGORIES.has(parsed.category.toUpperCase())
    ? (parsed.category.toUpperCase() as IngredientCategory)
    : ingredient.category;

  const cuisineTags = parsed.cuisineTags
    .map((c) => c.toUpperCase().replace(/[\s-]+/g, "_"))
    .filter((c) => VALID_CUISINES.has(c)) as Cuisine[];

  await prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      category,
      flavorTags: parsed.flavorTags,
      cuisineTags,
      description: parsed.description,
      ...(parsed.shelfLifeDays != null ? { shelfLifeDays: parsed.shelfLifeDays } : {}),
      ...(parsed.avgPricePerUnit != null ? { avgPricePerUnit: parsed.avgPricePerUnit } : {}),
    },
  });

  return {
    ingredientId,
    enriched: true,
    category,
    flavorTags: parsed.flavorTags,
    cuisineTags,
    description: parsed.description,
  };
}

/** Enrich multiple ingredients sequentially (each is a tiny AI call). */
export async function enrichNewIngredients(
  ingredientIds: string[],
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];
  for (const id of ingredientIds) {
    try {
      results.push(await enrichNewIngredient(id));
    } catch {
      // Individual enrichment failure shouldn't block others
    }
  }
  return results;
}
