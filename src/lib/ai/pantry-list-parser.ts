import Fuse from "fuse.js";
import { IngredientCategory } from "@prisma/client";
import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export interface PantryParsedItem {
  rawLine: string;
  parsedName: string;
  quantity: number;
  unit: string;
  aiCategory: string;
  matchedIngredientId: string | null;
  matchedIngredientName: string | null;
  confidence: "high" | "medium" | "low" | "unmatched";
  alternates: { id: string; name: string }[];
}

interface AiItem {
  rawLine: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

interface AiResponse {
  items: AiItem[];
}

const CATEGORY_LIST = Object.values(IngredientCategory).join(", ");

function classifyConfidence(score: number | undefined): PantryParsedItem["confidence"] {
  if (score === undefined) return "unmatched";
  if (score <= 0.2) return "high";
  if (score <= 0.4) return "medium";
  if (score <= 0.7) return "low";
  return "unmatched";
}

function normalizeCategory(raw: string): string {
  const u = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((Object.values(IngredientCategory) as string[]).includes(u)) return u;
  return "OTHER";
}

/** Pantry paste uses simple whole units; only g/ml when the user clearly wrote weight/volume. */
function normalizePantryUnit(raw: string | undefined): "count" | "g" | "ml" {
  const s = (raw ?? "").trim().toLowerCase();
  if (
    s === "g" ||
    s === "gram" ||
    s === "grams" ||
    s === "kg" ||
    s === "kilogram" ||
    s === "kilograms"
  ) {
    return "g";
  }
  if (
    s === "ml" ||
    s === "milliliter" ||
    s === "milliliters" ||
    s === "l" ||
    s === "liter" ||
    s === "liters" ||
    s === "litre" ||
    s === "litres"
  ) {
    return "ml";
  }
  return "count";
}

const PANTRY_LIST_SYSTEM = `You normalize informal pantry or grocery lists into structured ingredients for a kitchen inventory app. Use a SIMPLE quantity model — do not infer grams or milliliters unless the shopper actually wrote a weight or volume.

Return ONLY valid JSON with this shape:
{ "items": [ { "rawLine": "verbatim or closest user phrase", "name": "Canonical ingredient name (Title Case, specific)", "quantity": 1, "unit": "count"|"g"|"ml", "category": "ENUM" } ] }

category MUST be exactly one of: ${CATEGORY_LIST}

Unit rules (critical):
- **Default: unit must be "count"** for almost everything. One count = one natural whole purchase or piece: one onion, one lemon, one head of garlic, one bottle of oyster sauce, one jar of jam, one can of tomatoes, one tub of yogurt, one carton of milk, one package of pasta, one stick of butter, one bag of flour (unless they gave a weight).
- Condiments, sauces, oils, vinegars, pastes, syrups, soy sauce, fish sauce, etc. are **always "count"** unless the line explicitly states a volume (e.g. "500ml olive oil"). "Oyster sauce" alone → quantity 1, unit count (meaning one bottle).
- Use **"g"** only when the list clearly specifies weight (e.g. "500g cheddar", "2 lb beef" — keep their intended amount in quantity as a sensible number).
- Use **"ml"** only when the list clearly specifies a liquid volume (e.g. "250ml heavy cream", "1L milk").
- Vague lines ("some rice", "garlic", "parm") → quantity 1, unit count.

Other rules:
- Split on newlines, commas, semicolons, bullets (•-*), or "and". One object per distinct ingredient.
- "2 onions" or "onions x2" → quantity 2, unit count.
- Expand obvious abbreviations (evoo → Extra virgin olive oil, chx breast → Chicken Breast) when confident.
- Map each line to the closest category (e.g. onion → AROMATIC, oyster sauce → SAUCE or CONDIMENT).
- Drop section headers, store names, and non-food lines.
- If the same ingredient appears twice, merge into one item with summed quantity.
- Never invent niche brands; use generic culinary names that could exist in a database.`;

export async function parsePantryListPaste(rawText: string): Promise<PantryParsedItem[]> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: PANTRY_LIST_SYSTEM },
      {
        role: "user",
        content: `Parse this list:\n\n---\n${trimmed.slice(0, 12000)}\n---`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 8192,
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from model");

  let data: AiResponse;
  try {
    data = JSON.parse(content) as AiResponse;
  } catch {
    throw new Error("Model returned invalid JSON");
  }

  const allIngredients = await prisma.ingredient.findMany({
    select: { id: true, name: true, defaultUnit: true, category: true },
  });

  const fuse = new Fuse(allIngredients, {
    keys: ["name"],
    threshold: 0.55,
    includeScore: true,
  });

  const items: PantryParsedItem[] = (data.items ?? []).map((row) => {
    const results = fuse.search(row.name);
    const best = results[0];
    const aiCategory = normalizeCategory(row.category);

    const alternates = results.slice(0, 4).map((r) => ({
      id: r.item.id,
      name: r.item.name,
    }));

    if (best && best.score !== undefined && best.score <= 0.55) {
      // Keep pantry paste simple: never replace "count" with catalog defaultUnit (e.g. ml for sauces).
      const unit = normalizePantryUnit(row.unit);

      return {
        rawLine: row.rawLine || row.name,
        parsedName: row.name,
        quantity: Math.max(0.001, Number(row.quantity) || 1),
        unit,
        aiCategory,
        matchedIngredientId: best.item.id,
        matchedIngredientName: best.item.name,
        confidence: classifyConfidence(best.score),
        alternates,
      };
    }

    return {
      rawLine: row.rawLine || row.name,
      parsedName: row.name,
      quantity: Math.max(0.001, Number(row.quantity) || 1),
      unit: normalizePantryUnit(row.unit),
      aiCategory,
      matchedIngredientId: null,
      matchedIngredientName: null,
      confidence: "unmatched" as const,
      alternates,
    };
  });

  return items;
}
