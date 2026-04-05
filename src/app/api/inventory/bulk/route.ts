import { NextRequest, NextResponse, after } from "next/server";
import { IngredientCategory } from "@prisma/client";
import { z } from "zod";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { enrichNewIngredients } from "@/lib/engines/ingredient-enricher";
import { curateCookbook } from "@/lib/engines/cookbook-curator";
import { requireApiUserId } from "@/lib/auth/api-user";
import { resolveIngredientForWrite } from "@/lib/engines/ingredient-resolve";

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
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

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
    const newPantryIngredientIds: string[] = [];
    const newCatalogIngredientIds: string[] = [];

    for (const row of parsed.data.items) {
      let ingredientId = row.ingredientId;

      if (!ingredientId && row.newName) {
        const cat = row.category && validCategories.has(row.category)
          ? (row.category as IngredientCategory)
          : IngredientCategory.OTHER;
        const resolved = await resolveIngredientForWrite(prisma, row.newName, {
          allowCreateAdHoc: true,
          defaultCategory: cat,
          defaultUnit: row.unit,
          defaultStorage: row.location ?? "PANTRY",
        });
        ingredientId = resolved.ingredientId;
        if (resolved.created) {
          ingredientsCreated++;
          newCatalogIngredientIds.push(resolved.ingredientId);
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
        where: { userId, ingredientId },
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
            userId,
            ingredientId,
            quantity: row.quantity,
            unit: row.unit,
            purchaseDate,
            expiryDate,
            location,
          },
        });
        created++;
        newPantryIngredientIds.push(ingredientId);
      }
    }

    // Background: enrich new-to-catalog ingredients, then curate cookbook
    after(async () => {
      try {
        if (newCatalogIngredientIds.length > 0) {
          await enrichNewIngredients(newCatalogIngredientIds);
        }
        if (newPantryIngredientIds.length > 0) {
          await curateCookbook(userId, {
            newIngredientIds: newPantryIngredientIds,
          });
        }
      } catch {
        // Fire-and-forget; failures visible in GenerationJob / logs
      }
    });

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
