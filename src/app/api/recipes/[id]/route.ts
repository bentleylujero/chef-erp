import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getApiUserId, requireApiUserId } from "@/lib/auth/api-user";
import { recipeVisibilityClause } from "@/lib/recipes/visibility";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewerId = await getApiUserId();

    const recipe = await prisma.recipe.findFirst({
      where: { id, AND: [recipeVisibilityClause(viewerId)] },
      include: {
        ingredients: {
          include: { ingredient: true },
          orderBy: { ingredient: { category: "asc" } },
        },
        ratings: {
          orderBy: { cookedAt: "desc" },
          take: 20,
          select: {
            id: true,
            userId: true,
            rating: true,
            difficultyFelt: true,
            notes: true,
            wouldMakeAgain: true,
            cookedAt: true,
          },
        },
        cookingLogs: {
          orderBy: { cookedAt: "desc" },
          take: 10,
          select: {
            id: true,
            userId: true,
            cookedAt: true,
            actualPrepTime: true,
            actualCookTime: true,
            servingsCooked: true,
            notes: true,
            photoUrls: true,
          },
        },
        variants: {
          where: { status: "active" },
          select: { id: true, title: true, cuisine: true, difficulty: true },
        },
        parentRecipe: {
          select: { id: true, title: true },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json(recipe);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 500 },
    );
  }
}

const updateIngredientSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  isOptional: z.boolean().optional(),
  prepNote: z.string().nullable().optional(),
  substituteGroup: z.string().nullable().optional(),
});

const updateRecipeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  cuisine: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  techniques: z.array(z.string()).optional(),
  instructions: z
    .array(
      z.object({
        step: z.number(),
        technique: z.string().optional(),
        timing: z.string().optional(),
        notes: z.string().optional(),
        text: z.string(),
      }),
    )
    .optional(),
  prepTime: z.number().int().nonnegative().optional(),
  cookTime: z.number().int().nonnegative().optional(),
  servings: z.number().int().positive().optional(),
  flavorTags: z.record(z.string(), z.number()).optional(),
  tags: z.array(z.string()).optional(),
  platePrice: z.number().nonnegative().nullable().optional(),
  ingredients: z.array(updateIngredientSchema).min(1).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const { id } = await params;
    const body = await request.json();
    const parsed = updateRecipeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    if (
      existing.ownerUserId !== null &&
      existing.ownerUserId !== userId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.status === "archived") {
      return NextResponse.json(
        { error: "Cannot update an archived recipe" },
        { status: 400 },
      );
    }

    const { ingredients, flavorTags, ...fields } = parsed.data;
    const updateData: Record<string, unknown> = { ...fields };

    if (flavorTags !== undefined) {
      updateData.flavorTags = flavorTags;
    }

    if (ingredients) {
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
      updateData.ingredients = {
        create: ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          isOptional: ing.isOptional ?? false,
          prepNote: ing.prepNote ?? null,
          substituteGroup: ing.substituteGroup ?? null,
        })),
      };
    }

    const recipe = await prisma.recipe.update({
      where: { id },
      data: updateData,
      include: {
        ingredients: { include: { ingredient: true } },
      },
    });

    return NextResponse.json(recipe);
  } catch {
    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const { id } = await params;

    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    if (
      existing.ownerUserId !== null &&
      existing.ownerUserId !== userId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.recipe.update({
      where: { id },
      data: { status: "archived" },
    });

    return NextResponse.json({ success: true, id, status: "archived" });
  } catch {
    return NextResponse.json(
      { error: "Failed to archive recipe" },
      { status: 500 },
    );
  }
}
