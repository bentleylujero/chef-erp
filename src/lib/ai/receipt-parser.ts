import Fuse from "fuse.js";
import { openai, OPENAI_MODEL_VISION } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export interface ParsedReceiptItem {
  rawName: string;
  quantity: number;
  unit: string;
  price: number;
  matchedIngredientId: string | null;
  matchedIngredientName: string | null;
  confidence: "high" | "medium" | "low" | "unmatched";
}

export interface ParsedReceipt {
  storeName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  items: ParsedReceiptItem[];
}

interface VisionItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface VisionResponse {
  storeName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  items: VisionItem[];
}

const VISION_PROMPT = `ROLE: Receipt OCR → JSON only. No prose outside the JSON object.

Extract grocery line items from the image into this shape:
{"storeName":string|null,"receiptDate":"YYYY-MM-DD"|null,"totalAmount":number|null,"items":[{"name":string,"quantity":number,"unitPrice":number,"totalPrice":number}]}

Rules (be brief in string values; expand obvious abbreviations e.g. ORG→Organic):
- Every product line; skip tax, subtotal, payment, discounts
- quantity defaults 1 if missing; unitPrice = totalPrice/quantity when both known else mirror single price
- null store/date/total when illegible`;

function classifyConfidence(score: number | undefined): ParsedReceiptItem["confidence"] {
  if (score === undefined) return "unmatched";
  // Fuse.js scores: 0 = perfect match, 1 = no match (inverted from typical confidence)
  if (score <= 0.2) return "high";
  if (score <= 0.4) return "medium";
  if (score <= 0.7) return "low";
  return "unmatched";
}

function guessUnit(name: string): string {
  const lower = name.toLowerCase();
  const weightPatterns = /\b(lb|lbs|pound|oz|ounce|kg|gram)\b/;
  const volumePatterns = /\b(gal|gallon|qt|quart|pt|pint|fl oz|liter|ml)\b/;
  const countPatterns = /\b(bunch|head|bag|can|box|jar|bottle|pack|ct|count|dozen|doz)\b/;

  if (weightPatterns.test(lower)) return "lb";
  if (volumePatterns.test(lower)) return "ml";
  if (countPatterns.test(lower)) return "count";
  return "count";
}

export async function parseReceiptImage(imageBase64: string): Promise<ParsedReceipt> {
  const mediaType = imageBase64.startsWith("/9j") ? "image/jpeg" : "image/png";
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mediaType};base64,${imageBase64}`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL_VISION,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2500,
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from Vision API");

  let visionData: VisionResponse;
  try {
    visionData = JSON.parse(content) as VisionResponse;
  } catch {
    throw new Error("Vision API returned invalid JSON");
  }

  const allIngredients = await prisma.ingredient.findMany({
    select: { id: true, name: true, defaultUnit: true },
  });

  const fuse = new Fuse(allIngredients, {
    keys: ["name"],
    threshold: 0.7,
    includeScore: true,
  });

  const items: ParsedReceiptItem[] = (visionData.items ?? []).map((item) => {
    const results = fuse.search(item.name);
    const best = results[0];

    if (best && best.score !== undefined && best.score <= 0.7) {
      return {
        rawName: item.name,
        quantity: item.quantity || 1,
        unit: best.item.defaultUnit || guessUnit(item.name),
        price: item.totalPrice || item.unitPrice || 0,
        matchedIngredientId: best.item.id,
        matchedIngredientName: best.item.name,
        confidence: classifyConfidence(best.score),
      };
    }

    return {
      rawName: item.name,
      quantity: item.quantity || 1,
      unit: guessUnit(item.name),
      price: item.totalPrice || item.unitPrice || 0,
      matchedIngredientId: null,
      matchedIngredientName: null,
      confidence: "unmatched" as const,
    };
  });

  return {
    storeName: visionData.storeName ?? null,
    receiptDate: visionData.receiptDate ?? null,
    totalAmount: visionData.totalAmount ?? null,
    items,
  };
}
