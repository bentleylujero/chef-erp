import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays } from "date-fns";
import { curateCookbook } from "@/lib/engines/cookbook-curator";
import { requireApiUserId } from "@/lib/auth/api-user";

export async function GET(request: NextRequest) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const location = searchParams.get("location");
  const expiring = searchParams.get("expiring");

  const where: Record<string, unknown> = { userId };
  const ingredientWhere: Record<string, unknown> = {};

  if (search) {
    ingredientWhere.name = { contains: search, mode: "insensitive" };
  }
  if (category) {
    ingredientWhere.category = category;
  }
  if (Object.keys(ingredientWhere).length > 0) {
    where.ingredient = ingredientWhere;
  }
  if (location) {
    where.location = location;
  }
  if (expiring === "true") {
    where.expiryDate = { lte: addDays(new Date(), 3), gte: new Date() };
  }

  try {
    const items = await prisma.inventory.findMany({
      where,
      include: { ingredient: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 },
    );
  }
}

const createSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  purchaseDate: z.string().optional(),
  expiryDate: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  location: z.enum(["FRIDGE", "FREEZER", "PANTRY", "COUNTER"]).optional(),
  parLevel: z.number().nonnegative().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const purchaseDate = data.purchaseDate
      ? new Date(data.purchaseDate)
      : new Date();

    let expiryDate: Date | undefined;
    if (data.expiryDate) {
      expiryDate = new Date(data.expiryDate);
    } else {
      const ingredient = await prisma.ingredient.findUnique({
        where: { id: data.ingredientId },
        select: { shelfLifeDays: true },
      });
      if (ingredient?.shelfLifeDays) {
        expiryDate = addDays(purchaseDate, ingredient.shelfLifeDays);
      }
    }

    const item = await prisma.inventory.create({
      data: {
        userId,
        ingredientId: data.ingredientId,
        quantity: data.quantity,
        unit: data.unit,
        purchaseDate,
        expiryDate,
        cost: data.cost,
        location: data.location ?? "PANTRY",
        parLevel: data.parLevel,
      },
      include: { ingredient: true },
    });

    // Background: curate cookbook with the new ingredient
    after(async () => {
      try {
        await curateCookbook(userId, {
          newIngredientIds: [data.ingredientId],
        });
      } catch {
        // Fire-and-forget
      }
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create inventory item" },
      { status: 500 },
    );
  }
}
