import { NextRequest, NextResponse } from "next/server";
import { GroceryItemSource } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { categoryToStoreSection } from "@/lib/utils/categories";
import { requireApiUserId } from "@/lib/auth/api-user";

function estimateLineCost(quantity: number, pricePerUnit: number | null): number | null {
  if (pricePerUnit == null || pricePerUnit <= 0) return null;
  return Math.round(pricePerUnit * quantity * 100) / 100;
}

async function assertListOwner(listId: string, userId: string) {
  const list = await prisma.groceryList.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });
  return list;
}

async function recalcListEstimatedTotal(listId: string) {
  const items = await prisma.groceryItem.findMany({
    where: { listId },
    select: { estimatedCost: true },
  });
  const total = items.reduce((s, i) => s + (i.estimatedCost ?? 0), 0);
  await prisma.groceryList.update({
    where: { id: listId },
    data: { estimatedTotal: total > 0 ? total : null },
  });
}

async function respondWithFullList(listId: string) {
  const list = await prisma.groceryList.findUnique({
    where: { id: listId },
    include: {
      items: {
        include: { ingredient: true },
        orderBy: [{ storeSection: "asc" }, { ingredient: { name: "asc" } }],
      },
    },
  });
  if (!list) return null;
  return {
    id: list.id,
    name: list.name,
    status: list.status,
    estimatedTotal: list.estimatedTotal,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    items: list.items.map((item) => ({
      id: item.id,
      listId: item.listId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
      estimatedCost: item.estimatedCost,
      checked: item.checked,
      storeSection: item.storeSection,
      source: item.source,
      ingredient: {
        id: item.ingredient.id,
        name: item.ingredient.name,
        category: item.ingredient.category,
        defaultUnit: item.ingredient.defaultUnit,
        avgPricePerUnit: item.ingredient.avgPricePerUnit,
      },
    })),
  };
}

const addItemSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const { id: listId } = await params;
    const owner = await assertListOwner(listId, userId);
    if (!owner) {
      return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { ingredientId, quantity, unit } = parsed.data;
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    const existing = await prisma.groceryItem.findFirst({
      where: { listId, ingredientId, unit },
    });

    if (existing) {
      const newQty = Math.round((existing.quantity + quantity) * 1000) / 1000;
      const est = estimateLineCost(newQty, ingredient.avgPricePerUnit);
      await prisma.groceryItem.update({
        where: { id: existing.id },
        data: {
          quantity: newQty,
          estimatedCost: est,
          storeSection: categoryToStoreSection(ingredient.category),
        },
      });
    } else {
      const est = estimateLineCost(quantity, ingredient.avgPricePerUnit);
      await prisma.groceryItem.create({
        data: {
          listId,
          ingredientId,
          quantity,
          unit,
          estimatedCost: est,
          checked: false,
          storeSection: categoryToStoreSection(ingredient.category),
          source: GroceryItemSource.MANUAL,
        },
      });
    }

    await recalcListEstimatedTotal(listId);
    const payload = await respondWithFullList(listId);
    if (!payload) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    return NextResponse.json(payload, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to add grocery item" },
      { status: 500 },
    );
  }
}

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().positive().optional(),
  checked: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const { id: listId } = await params;
    const owner = await assertListOwner(listId, userId);
    if (!owner) {
      return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { itemId, quantity, checked } = parsed.data;
    if (quantity === undefined && checked === undefined) {
      return NextResponse.json(
        { error: "Provide quantity and/or checked" },
        { status: 400 },
      );
    }

    const item = await prisma.groceryItem.findFirst({
      where: { id: itemId, listId },
      include: { ingredient: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const newQty = quantity ?? item.quantity;
    const est = estimateLineCost(newQty, item.ingredient.avgPricePerUnit);

    await prisma.groceryItem.update({
      where: { id: itemId },
      data: {
        ...(quantity !== undefined ? { quantity } : {}),
        ...(checked !== undefined ? { checked } : {}),
        estimatedCost: est,
      },
    });

    await recalcListEstimatedTotal(listId);
    const payload = await respondWithFullList(listId);
    if (!payload) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to update grocery item" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const { id: listId } = await params;
    const owner = await assertListOwner(listId, userId);
    if (!owner) {
      return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
    }

    const itemId = request.nextUrl.searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json(
        { error: "Missing itemId query parameter" },
        { status: 400 },
      );
    }

    const item = await prisma.groceryItem.findFirst({
      where: { id: itemId, listId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.groceryItem.delete({ where: { id: itemId } });
    await recalcListEstimatedTotal(listId);

    const payload = await respondWithFullList(listId);
    if (!payload) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to remove grocery item" },
      { status: 500 },
    );
  }
}
