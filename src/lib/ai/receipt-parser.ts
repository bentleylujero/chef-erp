import Fuse from "fuse.js";
import { openai } from "@/lib/openai";
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

const VISION_PROMPT = `You are a receipt OCR specialist. Analyze this grocery receipt image and extract all line items as structured JSON.

Return ONLY valid JSON in this exact format:
{
  "storeName": "Store Name or null",
  "receiptDate": "YYYY-MM-DD or null",
  "totalAmount": 0.00,
  "items": [
    {
      "name": "item name as written on receipt",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00
    }
  ]
}

Rules:
- Extract every line item, even if partially readable
- Normalize item names: expand abbreviations (e.g. "ORG" → "Organic", "BNL SKNL" → "Boneless Skinless")
- If quantity is not explicitly listed, default to 1
- unitPrice = totalPrice / quantity
- If only one price is visible, use it for both unitPrice and totalPrice
- Exclude tax lines, subtotals, discounts, and payment method lines
- For produce sold by weight, use the weight as quantity and set unit price accordingly
- Return null for storeName/receiptDate if not visible`;

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
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
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
