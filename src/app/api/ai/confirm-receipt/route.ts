import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays } from "date-fns";
import { checkNewIngredientGeneration } from "@/lib/engines/generation-trigger";
import { scheduleNewIngredientRecipeGeneration } from "@/lib/engines/schedule-new-ingredient-recipes";
import { requireApiUserId } from "@/lib/auth/api-user";

const confirmSchema = z.object({
  items: z.array(
    z.object({
      ingredientId: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      cost: z.number().nonnegative(),
    }),
  ),
  storeName: z.string().nullable().optional(),
  receiptDate: z.string().nullable().optional(),
  totalAmount: z.number().nullable().optional(),
  imageBase64: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { items, storeName, receiptDate, totalAmount, imageBase64 } =
      parsed.data;

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No items to confirm" },
        { status: 400 },
      );
    }

    const receiptScan = await prisma.receiptScan.create({
      data: {
        userId,
        imageUrl: imageBase64 ? "data:image/receipt" : "manual-entry",
        status: "CONFIRMED",
        storeName: storeName ?? null,
        receiptDate: receiptDate ? new Date(receiptDate) : null,
        totalAmount: totalAmount ?? null,
        parsedItems: items.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          unit: i.unit,
          cost: i.cost,
          matched: true,
        })),
      },
    });

    const purchaseDate = receiptDate ? new Date(receiptDate) : new Date();

    const purchaseHistoryData = items.map((item) => ({
      userId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
      cost: item.cost,
      store: storeName ?? null,
      purchasedAt: purchaseDate,
      receiptScanId: receiptScan.id,
    }));

    await prisma.purchaseHistory.createMany({ data: purchaseHistoryData });

    const ingredientDetails = await prisma.ingredient.findMany({
      where: { id: { in: items.map((i) => i.ingredientId) } },
      select: { id: true, shelfLifeDays: true, storageType: true },
    });
    const ingredientMap = new Map(ingredientDetails.map((i) => [i.id, i]));

    let inventoryUpdated = 0;
    let inventoryCreated = 0;
    const newPantryIngredientIds: string[] = [];

    for (const item of items) {
      const existing = await prisma.inventory.findFirst({
        where: {
          userId,
          ingredientId: item.ingredientId,
        },
      });

      const ingredient = ingredientMap.get(item.ingredientId);
      const expiryDate = ingredient?.shelfLifeDays
        ? addDays(purchaseDate, ingredient.shelfLifeDays)
        : null;

      if (existing) {
        await prisma.inventory.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + item.quantity,
            cost: item.cost,
            purchaseDate: purchaseDate,
            expiryDate: expiryDate ?? existing.expiryDate,
          },
        });
        inventoryUpdated++;
      } else {
        await prisma.inventory.create({
          data: {
            userId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
            cost: item.cost,
            purchaseDate: purchaseDate,
            expiryDate,
            location: ingredient?.storageType ?? "PANTRY",
          },
        });
        inventoryCreated++;
        newPantryIngredientIds.push(item.ingredientId);
      }
    }

    const signalData = items.map((item) => ({
      userId,
      signalType: "PURCHASED" as const,
      entityType: "INGREDIENT" as const,
      entityId: item.ingredientId,
      metadata: {
        quantity: item.quantity,
        unit: item.unit,
        cost: item.cost,
        store: storeName ?? null,
        receiptScanId: receiptScan.id,
      },
    }));

    await prisma.preferenceSignal.createMany({ data: signalData });

    scheduleNewIngredientRecipeGeneration(userId, newPantryIngredientIds);

    const genDecision = await checkNewIngredientGeneration(
      userId,
      newPantryIngredientIds,
    );
    const generationTriggered = genDecision.shouldGenerate;

    if (generationTriggered) {
      await prisma.receiptScan.update({
        where: { id: receiptScan.id },
        data: { generationTriggered: true },
      });
    }

    const totalCost = items.reduce((sum, i) => sum + i.cost, 0);

    return NextResponse.json({
      receiptScanId: receiptScan.id,
      itemsProcessed: items.length,
      inventoryUpdated,
      inventoryCreated,
      totalCost,
      generationTriggered,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm receipt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
