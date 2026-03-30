import { NextRequest, NextResponse } from "next/server";
import { IngredientCategory } from "@prisma/client";
import { z } from "zod";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user";

const validCategories = new Set(
  Object.values(IngredientCategory) as string[],
);

const bulkItemSchema = z
  .object({
    ingredientId: z.string().min(1).optional(),
    newName: z.string().min(1).optional(),
    category: z.string().optional(),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    location: z.enum(["FRIDGE", "FREEZER", "PANTRY", "COUNTER"]).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.ingredientId && !val.newName) {
      ctx.addIssue({
        code: "custom",
        message: "Each item needs ingredientId or newName",
        path: [],
      });
    }
  });

const bulkSchema = z.object({
  items: z.array(bulkItemSchema).min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(" · ");
      return NextResponse.json(
        { error: message || "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const purchaseDate = new Date();
    let created = 0;
    let updated = 0;
    let ingredientsCreated = 0;

    for (const row of parsed.data.items) {
      let ingredientId = row.ingredientId;

      if (!ingredientId && row.newName) {
        const existing = await prisma.ingredient.findFirst({
          where: { name: { equals: row.newName, mode: "insensitive" } },
        });
        if (existing) {
          ingredientId = existing.id;
        } else {
          const cat = row.category && validCategories.has(row.category)
            ? (row.category as IngredientCategory)
            : IngredientCategory.OTHER;
          const createdIng = await prisma.ingredient.create({
            data: {
              name: row.newName.trim(),
              category: cat,
              defaultUnit: row.unit,
              storageType: row.location ?? "PANTRY",
            },
          });
          ingredientId = createdIng.id;
          ingredientsCreated++;
        }
      }

      if (!ingredientId) continue;

      const ingredient = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
        select: {
          shelfLifeDays: true,
          storageType: true,
          defaultUnit: true,
        },
      });
      if (!ingredient) continue;

      const expiryDate = ingredient.shelfLifeDays
        ? addDays(purchaseDate, ingredient.shelfLifeDays)
        : null;

      const location = (row.location ??
        ingredient.storageType ??
        "PANTRY") as "FRIDGE" | "FREEZER" | "PANTRY" | "COUNTER";

      const existingInv = await prisma.inventory.findFirst({
        where: { userId: DEMO_USER_ID, ingredientId },
      });

      if (existingInv) {
        await prisma.inventory.update({
          where: { id: existingInv.id },
          data: {
            quantity: existingInv.quantity + row.quantity,
            purchaseDate,
            expiryDate: expiryDate ?? existingInv.expiryDate,
            location,
          },
        });
        updated++;
      } else {
        await prisma.inventory.create({
          data: {
            userId: DEMO_USER_ID,
            ingredientId,
            quantity: row.quantity,
            unit: row.unit,
            purchaseDate,
            expiryDate,
            location,
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      created,
      updated,
      ingredientsCreated,
      processed: parsed.data.items.length,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to bulk add inventory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
