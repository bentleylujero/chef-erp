import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parseISO } from "date-fns";

const updateEntrySchema = z.object({
  recipeId: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).optional(),
  scaledServings: z.number().int().positive().nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { date, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };

    if (date) {
      updateData.date = parseISO(date);
    }

    const entry = await prisma.mealPlanEntry.update({
      where: { id },
      data: updateData,
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            cuisine: true,
            difficulty: true,
            prepTime: true,
            cookTime: true,
            servings: true,
            platePrice: true,
            tags: true,
          },
        },
      },
    });

    return NextResponse.json(entry);
  } catch {
    return NextResponse.json(
      { error: "Failed to update meal plan entry" },
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
    await prisma.mealPlanEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete meal plan entry" },
      { status: 500 },
    );
  }
}
