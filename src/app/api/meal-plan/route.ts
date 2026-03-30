import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { startOfWeek, parseISO } from "date-fns";

const DEMO_USER_ID = "demo-user";

function getMonday(dateStr?: string | null): Date {
  const base = dateStr ? parseISO(dateStr) : new Date();
  return startOfWeek(base, { weekStartsOn: 1 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const weekStart = getMonday(searchParams.get("weekStart"));

  try {
    let plan = await prisma.mealPlan.findUnique({
      where: {
        userId_weekStart: { userId: DEMO_USER_ID, weekStart },
      },
      include: {
        entries: {
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
                ingredients: {
                  include: { ingredient: true },
                },
              },
            },
          },
          orderBy: [{ date: "asc" }, { mealType: "asc" }],
        },
      },
    });

    if (!plan) {
      plan = await prisma.mealPlan.create({
        data: { userId: DEMO_USER_ID, weekStart },
        include: {
          entries: {
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
                  ingredients: {
                    include: { ingredient: true },
                  },
                },
              },
            },
            orderBy: [{ date: "asc" }, { mealType: "asc" }],
          },
        },
      });
    }

    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch meal plan" },
      { status: 500 },
    );
  }
}

const createEntrySchema = z.object({
  recipeId: z.string().min(1),
  date: z.string().min(1),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  scaledServings: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { recipeId, date, mealType, scaledServings } = parsed.data;
    const entryDate = parseISO(date);
    const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });

    const plan = await prisma.mealPlan.upsert({
      where: {
        userId_weekStart: { userId: DEMO_USER_ID, weekStart },
      },
      create: { userId: DEMO_USER_ID, weekStart },
      update: {},
    });

    const entry = await prisma.mealPlanEntry.create({
      data: {
        planId: plan.id,
        recipeId,
        date: entryDate,
        mealType: mealType as "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK",
        scaledServings,
      },
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

    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to add meal plan entry" },
      { status: 500 },
    );
  }
}
