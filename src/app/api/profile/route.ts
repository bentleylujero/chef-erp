import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireApiUserId } from "@/lib/auth/api-user";

export async function GET() {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        flavorProfile: true,
        cookingStyle: true,
        techniqueLogs: { orderBy: { comfortLevel: "desc" } },
        _count: {
          select: {
            cookingLogs: true,
            recipeRatings: true,
            preferenceSignals: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [avgRating, favoriteCuisine, favoriteTechnique] = await Promise.all([
      prisma.recipeRating.aggregate({
        where: { userId },
        _avg: { rating: true },
      }),
      prisma.cookingLog.groupBy({
        by: ["recipeId"],
        where: { userId },
        _count: true,
        orderBy: { _count: { recipeId: "desc" } },
        take: 1,
      }),
      prisma.techniqueLog.findFirst({
        where: { userId },
        orderBy: { timesPerformed: "desc" },
      }),
    ]);

    let topCuisine: string | null = null;
    if (favoriteCuisine.length > 0) {
      const topRecipe = await prisma.recipe.findUnique({
        where: { id: favoriteCuisine[0].recipeId },
        select: { cuisine: true },
      });
      topCuisine = topRecipe?.cuisine ?? null;
    }

    return NextResponse.json({
      ...user,
      stats: {
        totalRecipesCooked: user._count.cookingLogs,
        totalRatings: user._count.recipeRatings,
        avgRatingGiven: avgRating._avg.rating,
        favoriteCuisine: topCuisine,
        favoriteTechnique: favoriteTechnique?.technique ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 },
    );
  }
}

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  skillLevel: z.enum(["INTERMEDIATE", "ADVANCED", "PROFESSIONAL"]).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  kitchenEquipment: z.array(z.string()).optional(),
  cookingStyle: z
    .object({
      primaryCuisines: z.array(z.string()).optional(),
      exploringCuisines: z.array(z.string()).optional(),
      preferredTechniques: z.array(z.string()).optional(),
      cookingPhilosophy: z.string().nullable().optional(),
      mealPrepStyle: z.enum(["BATCH", "DAILY", "MIXED"]).optional(),
    })
    .optional(),
  flavorProfile: z
    .object({
      spiceTolerance: z.number().min(1).max(10).optional(),
      sweetPref: z.number().min(1).max(10).optional(),
      saltyPref: z.number().min(1).max(10).optional(),
      sourPref: z.number().min(1).max(10).optional(),
      umamiPref: z.number().min(1).max(10).optional(),
      bitterPref: z.number().min(1).max(10).optional(),
      ingredientAversions: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { cookingStyle, flavorProfile, ...userData } = parsed.data;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: userData,
    });

    if (cookingStyle) {
      await prisma.cookingStyle.upsert({
        where: { userId },
        update: cookingStyle as any,
        create: { userId, ...cookingStyle } as any,
      });
    }

    if (flavorProfile) {
      await prisma.flavorProfile.upsert({
        where: { userId },
        update: flavorProfile,
        create: { userId, ...flavorProfile },
      });
    }

    return NextResponse.json(updatedUser);
  } catch {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
