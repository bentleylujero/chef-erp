import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEMO_USER_ID = "demo-user";

const onboardingSchema = z.object({
  name: z.string().min(1).default("Chef"),
  email: z.string().email().default("chef@bentley.kitchen"),
  skillLevel: z.enum(["INTERMEDIATE", "ADVANCED", "PROFESSIONAL"]),
  kitchenEquipment: z.array(z.string()),
  dietaryRestrictions: z.array(z.string()),
  primaryCuisines: z.array(z.string()),
  exploringCuisines: z.array(z.string()),
  cookingPhilosophy: z.string().optional(),
  flavorProfile: z.object({
    spiceTolerance: z.number().int().min(1).max(10),
    sweetPref: z.number().int().min(1).max(10),
    saltyPref: z.number().int().min(1).max(10),
    sourPref: z.number().int().min(1).max(10),
    umamiPref: z.number().int().min(1).max(10),
    bitterPref: z.number().int().min(1).max(10),
    ingredientAversions: z.array(z.string()),
  }),
  pantryItems: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const user = await prisma.user.upsert({
      where: { id: DEMO_USER_ID },
      create: {
        id: DEMO_USER_ID,
        email: data.email,
        name: data.name,
        skillLevel: data.skillLevel,
        kitchenEquipment: data.kitchenEquipment,
        dietaryRestrictions: data.dietaryRestrictions,
        onboardingComplete: true,
      },
      update: {
        email: data.email,
        name: data.name,
        skillLevel: data.skillLevel,
        kitchenEquipment: data.kitchenEquipment,
        dietaryRestrictions: data.dietaryRestrictions,
        onboardingComplete: true,
      },
    });

    await prisma.flavorProfile.upsert({
      where: { userId: DEMO_USER_ID },
      create: {
        userId: DEMO_USER_ID,
        spiceTolerance: data.flavorProfile.spiceTolerance,
        sweetPref: data.flavorProfile.sweetPref,
        saltyPref: data.flavorProfile.saltyPref,
        sourPref: data.flavorProfile.sourPref,
        umamiPref: data.flavorProfile.umamiPref,
        bitterPref: data.flavorProfile.bitterPref,
        ingredientAversions: data.flavorProfile.ingredientAversions,
      },
      update: {
        spiceTolerance: data.flavorProfile.spiceTolerance,
        sweetPref: data.flavorProfile.sweetPref,
        saltyPref: data.flavorProfile.saltyPref,
        sourPref: data.flavorProfile.sourPref,
        umamiPref: data.flavorProfile.umamiPref,
        bitterPref: data.flavorProfile.bitterPref,
        ingredientAversions: data.flavorProfile.ingredientAversions,
      },
    });

    await prisma.cookingStyle.upsert({
      where: { userId: DEMO_USER_ID },
      create: {
        userId: DEMO_USER_ID,
        primaryCuisines: data.primaryCuisines as never[],
        exploringCuisines: data.exploringCuisines as never[],
        cookingPhilosophy: data.cookingPhilosophy,
      },
      update: {
        primaryCuisines: data.primaryCuisines as never[],
        exploringCuisines: data.exploringCuisines as never[],
        cookingPhilosophy: data.cookingPhilosophy,
      },
    });

    if (data.pantryItems.length > 0) {
      await prisma.inventory.deleteMany({ where: { userId: DEMO_USER_ID } });

      for (const item of data.pantryItems) {
        let ingredient = await prisma.ingredient.findFirst({
          where: { name: { equals: item.name, mode: "insensitive" } },
        });

        if (!ingredient) {
          ingredient = await prisma.ingredient.create({
            data: {
              name: item.name,
              category: "OTHER",
              defaultUnit: item.unit,
              storageType: "PANTRY",
            },
          });
        }

        await prisma.inventory.create({
          data: {
            userId: DEMO_USER_ID,
            ingredientId: ingredient.id,
            quantity: item.quantity,
            unit: item.unit,
            location: "PANTRY",
          },
        });
      }
    }

    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onboarding failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
