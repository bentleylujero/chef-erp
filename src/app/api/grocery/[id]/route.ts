import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const list = await prisma.groceryList.findFirst({
      where: { id, userId: DEMO_USER_ID },
      include: {
        items: {
          include: {
            ingredient: true,
          },
          orderBy: [{ storeSection: "asc" }, { ingredient: { name: "asc" } }],
        },
      },
    });

    if (!list) {
      return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch grocery list" },
      { status: 500 },
    );
  }
}

const updateListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await prisma.groceryList.findFirst({
      where: { id, userId: DEMO_USER_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
    }

    const list = await prisma.groceryList.update({
      where: { id },
      data: parsed.data,
      include: {
        items: {
          include: { ingredient: true },
          orderBy: [{ storeSection: "asc" }, { ingredient: { name: "asc" } }],
        },
      },
    });

    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update grocery list" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const existing = await prisma.groceryList.findFirst({
      where: { id, userId: DEMO_USER_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
    }

    await prisma.groceryList.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete grocery list" },
      { status: 500 },
    );
  }
}
