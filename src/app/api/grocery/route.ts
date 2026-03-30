import { NextRequest, NextResponse } from "next/server";
import {
  type IngredientCategory,
  type Prisma,
  GroceryItemSource,
} from "@prisma/client";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { categoryToStoreSection } from "@/lib/utils/categories";

const DEMO_USER_ID = "demo-user";

type AggKey = string;

function aggKey(ingredientId: string, unit: string): AggKey {
  return `${ingredientId}\u0000${unit}`;
}

async function getInventoryTotalsByKey(
  userId: string,
): Promise<Map<AggKey, number>> {
  const rows = await prisma.inventory.findMany({
    where: { userId },
    select: { ingredientId: true, quantity: true, unit: true },
  });
  const map = new Map<AggKey, number>();
  for (const row of rows) {
    const k = aggKey(row.ingredientId, row.unit);
    map.set(k, (map.get(k) ?? 0) + row.quantity);
  }
  return map;
}

async function fetchCurrentWeekMealPlan(userId: string) {
  const weekStart = startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = addDays(weekStart, 7);
  return prisma.mealPlan.findFirst({
    where: {
      userId,
      weekStart: { gte: weekStart, lt: weekEnd },
    },
    include: {
      entries: {
        include: {
          recipe: {
            include: {
              ingredients: { include: { ingredient: true } },
            },
          },
        },
      },
    },
  });
}

type MergedLine = {
  ingredientId: string;
  unit: string;
  quantity: number;
  category: IngredientCategory;
  sources: GroceryItemSource[];
};

function mergeLine(
  map: Map<AggKey, MergedLine>,
  ingredientId: string,
  unit: string,
  quantity: number,
  category: IngredientCategory,
  source: GroceryItemSource,
) {
  const k = aggKey(ingredientId, unit);
  const prev = map.get(k);
  if (prev) {
    prev.quantity += quantity;
    if (!prev.sources.includes(source)) prev.sources.push(source);
  } else {
    map.set(k, {
      ingredientId,
      unit,
      quantity,
      category,
      sources: [source],
    });
  }
}

function pickItemSource(sources: GroceryItemSource[]): GroceryItemSource {
  if (sources.includes(GroceryItemSource.MEAL_PLAN))
    return GroceryItemSource.MEAL_PLAN;
  return GroceryItemSource.PAR_LEVEL;
}

async function aggregateMealPlanGrossNeeds(userId: string): Promise<
  Map<
    AggKey,
    {
      ingredientId: string;
      unit: string;
      qty: number;
      category: IngredientCategory;
    }
  >
> {
  const gross = new Map<
    AggKey,
    {
      ingredientId: string;
      unit: string;
      qty: number;
      category: IngredientCategory;
    }
  >();
  const plan = await fetchCurrentWeekMealPlan(userId);
  if (!plan) return gross;

  for (const entry of plan.entries) {
    const recipe = entry.recipe;
    const baseServings = recipe.servings || 1;
    const targetServings = entry.scaledServings ?? recipe.servings;
    const factor = targetServings / baseServings;

    for (const ri of recipe.ingredients) {
      if (ri.isOptional) continue;
      const k = aggKey(ri.ingredientId, ri.unit);
      const add = ri.quantity * factor;
      const prev = gross.get(k);
      if (prev) prev.qty += add;
      else
        gross.set(k, {
          ingredientId: ri.ingredientId,
          unit: ri.unit,
          qty: add,
          category: ri.ingredient.category,
        });
    }
  }
  return gross;
}

async function buildMealPlanNeedMap(
  userId: string,
  invTotals: Map<AggKey, number>,
): Promise<Map<AggKey, MergedLine>> {
  const result = new Map<AggKey, MergedLine>();
  const gross = await aggregateMealPlanGrossNeeds(userId);
  for (const [k, v] of gross) {
    const have = invTotals.get(k) ?? 0;
    const remaining = Math.max(0, v.qty - have);
    if (remaining <= 0) continue;
    mergeLine(
      result,
      v.ingredientId,
      v.unit,
      remaining,
      v.category,
      GroceryItemSource.MEAL_PLAN,
    );
  }
  return result;
}

async function buildParDeficitMap(
  userId: string,
): Promise<Map<AggKey, MergedLine>> {
  const result = new Map<AggKey, MergedLine>();
  const rows = await prisma.inventory.findMany({
    where: { userId, parLevel: { not: null } },
    include: { ingredient: true },
  });
  for (const row of rows) {
    if (row.parLevel == null) continue;
    if (row.quantity >= row.parLevel) continue;
    const deficit = row.parLevel - row.quantity;
    mergeLine(
      result,
      row.ingredientId,
      row.unit,
      deficit,
      row.ingredient.category,
      GroceryItemSource.PAR_LEVEL,
    );
  }
  return result;
}

function mergeMaps(
  a: Map<AggKey, MergedLine>,
  b: Map<AggKey, MergedLine>,
): Map<AggKey, MergedLine> {
  const out = new Map<AggKey, MergedLine>();
  for (const [k, v] of a) {
    out.set(k, {
      ...v,
      sources: [...v.sources],
    });
  }
  for (const [k, v] of b) {
    const prev = out.get(k);
    if (prev) {
      prev.quantity += v.quantity;
      for (const s of v.sources) {
        if (!prev.sources.includes(s)) prev.sources.push(s);
      }
    } else {
      out.set(k, { ...v, sources: [...v.sources] });
    }
  }
  return out;
}

async function loadIngredientCosts(
  ids: string[],
): Promise<Map<string, number | null>> {
  if (ids.length === 0) return new Map();
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ids } },
    select: { id: true, avgPricePerUnit: true },
  });
  return new Map(ingredients.map((i) => [i.id, i.avgPricePerUnit]));
}

async function createItemsForList(
  listId: string,
  lines: Map<AggKey, MergedLine>,
) {
  const ids = [...new Set([...lines.values()].map((l) => l.ingredientId))];
  const costById = await loadIngredientCosts(ids);
  let estimatedTotal = 0;

  const data: Prisma.GroceryItemCreateManyInput[] = [];
  for (const line of lines.values()) {
    const price = costById.get(line.ingredientId) ?? null;
    const est =
      price != null && price > 0 ? Math.round(price * line.quantity * 100) / 100 : null;
    if (est != null) estimatedTotal += est;
    data.push({
      listId,
      ingredientId: line.ingredientId,
      quantity: Math.round(line.quantity * 1000) / 1000,
      unit: line.unit,
      estimatedCost: est,
      checked: false,
      storeSection: categoryToStoreSection(line.category),
      source: pickItemSource(line.sources),
    });
  }

  if (data.length > 0) {
    await prisma.groceryItem.createMany({ data });
  }

  await prisma.groceryList.update({
    where: { id: listId },
    data: {
      estimatedTotal: estimatedTotal > 0 ? estimatedTotal : null,
    },
  });
}

export async function GET() {
  try {
    const lists = await prisma.groceryList.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { updatedAt: "desc" },
      include: {
        items: { select: { checked: true } },
      },
    });

    const payload = lists.map((list) => {
      const itemCount = list.items.length;
      const checkedCount = list.items.filter((i) => i.checked).length;
      return {
        id: list.id,
        name: list.name,
        status: list.status,
        estimatedTotal: list.estimatedTotal,
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
        itemCount,
        checkedCount,
      };
    });

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch grocery lists" },
      { status: 500 },
    );
  }
}

const createListSchema = z.object({
  name: z.string().min(1).max(200),
  source: z.enum(["manual", "meal-plan", "smart"]).default("manual"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { name, source } = parsed.data;
    const invTotals = await getInventoryTotalsByKey(DEMO_USER_ID);

    const list = await prisma.groceryList.create({
      data: {
        userId: DEMO_USER_ID,
        name,
        status: "DRAFT",
        estimatedTotal: null,
      },
    });

    if (source === "meal-plan") {
      const mealNeeds = await buildMealPlanNeedMap(DEMO_USER_ID, invTotals);
      await createItemsForList(list.id, mealNeeds);
    } else if (source === "smart") {
      const mealNeeds = await buildMealPlanNeedMap(DEMO_USER_ID, invTotals);
      const parNeeds = await buildParDeficitMap(DEMO_USER_ID);
      const merged = mergeMaps(mealNeeds, parNeeds);
      await createItemsForList(list.id, merged);
    }

    const full = await prisma.groceryList.findUnique({
      where: { id: list.id },
      include: {
        items: { select: { checked: true } },
      },
    });

    if (!full) {
      return NextResponse.json(
        { error: "Failed to load created list" },
        { status: 500 },
      );
    }

    const itemCount = full.items.length;
    const checkedCount = full.items.filter((i) => i.checked).length;

    return NextResponse.json(
      {
        id: full.id,
        name: full.name,
        status: full.status,
        estimatedTotal: full.estimatedTotal,
        createdAt: full.createdAt.toISOString(),
        updatedAt: full.updatedAt.toISOString(),
        itemCount,
        checkedCount,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create grocery list" },
      { status: 500 },
    );
  }
}
