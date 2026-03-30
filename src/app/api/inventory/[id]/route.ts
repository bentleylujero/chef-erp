import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  purchaseDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  location: z.enum(["FRIDGE", "FREEZER", "PANTRY", "COUNTER"]).optional(),
  parLevel: z.number().nonnegative().nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { purchaseDate, expiryDate, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };

    if (purchaseDate !== undefined) {
      updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    }
    if (expiryDate !== undefined) {
      updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }

    const item = await prisma.inventory.update({
      where: { id },
      data: updateData,
      include: { ingredient: true },
    });

    return NextResponse.json(item);
  } catch {
    return NextResponse.json(
      { error: "Failed to update inventory item" },
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
    await prisma.inventory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete inventory item" },
      { status: 500 },
    );
  }
}
