import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestIngredients } from "@/lib/engines/ingredient-resolve";
import type { ResolveVia } from "@/lib/engines/ingredient-resolve";

function matchedViaLabel(via: ResolveVia): string {
  switch (via) {
    case "exact_name":
      return "Exact name";
    case "alias":
      return "Alias match";
    case "fuzzy":
      return "Did you mean";
    default:
      return via;
  }
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(
      Math.max(1, parseInt(rawLimit ?? "15", 10) || 15),
      50,
    );

    if (q.length < 1) {
      return NextResponse.json([]);
    }

    const suggestions = await suggestIngredients(prisma, q, limit);
    if (suggestions.length === 0) {
      return NextResponse.json([]);
    }

    const ids = suggestions.map((s) => s.ingredientId);
    const rows = await prisma.ingredient.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const ordered = suggestions
      .map((s) => {
        const ing = byId.get(s.ingredientId);
        if (!ing) return null;
        return {
          id: ing.id,
          name: ing.name,
          category: ing.category,
          defaultUnit: ing.defaultUnit,
          shelfLifeDays: ing.shelfLifeDays,
          storageType: ing.storageType,
          avgPricePerUnit: ing.avgPricePerUnit,
          description: ing.description,
          catalogTier: ing.catalogTier,
          matchedVia: matchedViaLabel(s.via),
          resolveVia: s.via,
        };
      })
      .filter(Boolean);

    return NextResponse.json(ordered);
  } catch {
    return NextResponse.json(
      { error: "Failed to suggest ingredients" },
      { status: 500 },
    );
  }
}
