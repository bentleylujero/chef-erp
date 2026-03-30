import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const DEMO_USER_ID = "demo-user";

type SortOption = "newest" | "rating" | "cooks";

const SORT_MAP: Record<SortOption, Prisma.RecipeOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  rating: { avgRating: "desc" },
  cooks: { totalCooks: "desc" },
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const cuisine = searchParams.get("cuisine");
  const difficulty = searchParams.get("difficulty");
  const technique = searchParams.get("technique");
  const source = searchParams.get("source");
  const sort = (searchParams.get("sort") ?? "newest") as SortOption;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const where: Prisma.RecipeWhereInput = { status: "active" };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { tags: { hasSome: [search.toLowerCase()] } },
    ];
  }
  if (cuisine) {
    where.cuisine = cuisine as Prisma.EnumCuisineFilter;
  }
  if (difficulty) {
    where.difficulty = parseInt(difficulty, 10);
  }
  if (technique) {
    where.techniques = { has: technique as never };
  }
  if (source) {
    where.source = source as Prisma.EnumRecipeSourceFilter;
  }

  try {
    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          cuisine: true,
          difficulty: true,
          techniques: true,
          prepTime: true,
          cookTime: true,
          servings: true,
          tags: true,
          source: true,
          totalCooks: true,
          avgRating: true,
          status: true,
          createdAt: true,
          _count: { select: { ingredients: true, ratings: true } },
        },
        orderBy: SORT_MAP[sort] ?? SORT_MAP.newest,
        take: limit,
        skip: offset,
      }),
      prisma.recipe.count({ where }),
    ]);

    return NextResponse.json({
      recipes,
      total,
      limit,
      offset,
      hasMore: offset + recipes.length < total,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 },
    );
  }
}

const ingredientSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  isOptional: z.boolean().optional(),
  prepNote: z.string().optional(),
  substituteGroup: z.string().optional(),
});

const createRecipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  cuisine: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  techniques: z.array(z.string()).default([]),
  instructions: z.array(z.object({
    step: z.number(),
    technique: z.string().optional(),
    timing: z.string().optional(),
    notes: z.string().optional(),
    text: z.string(),
  })),
  prepTime: z.number().int().nonnegative(),
  cookTime: z.number().int().nonnegative(),
  servings: z.number().int().positive(),
  flavorTags: z.record(z.string(), z.number()).optional(),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(ingredientSchema).min(1),
  platePrice: z.number().nonnegative().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createRecipeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { ingredients, ...recipeData } = parsed.data;

    const pantrySnapshot = await prisma.inventory.findMany({
      where: { userId: DEMO_USER_ID },
      select: { ingredientId: true },
    });

    const recipe = await prisma.recipe.create({
      data: {
        ...recipeData,
        cuisine: recipeData.cuisine as any,
        techniques: recipeData.techniques as any,
        flavorTags: recipeData.flavorTags ?? {},
        source: "USER_CREATED" as any,
        pantrySnapshotAtGen: pantrySnapshot.map((i) => i.ingredientId),
        ingredients: {
          create: ingredients.map((ing) => ({
            ingredientId: ing.ingredientId,
            quantity: ing.quantity,
            unit: ing.unit,
            isOptional: ing.isOptional ?? false,
            prepNote: ing.prepNote,
            substituteGroup: ing.substituteGroup,
          })),
        },
      },
      include: {
        ingredients: { include: { ingredient: true } },
      },
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create recipe" },
      { status: 500 },
    );
  }
}
