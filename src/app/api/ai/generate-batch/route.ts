import { NextRequest, NextResponse } from "next/server";
import { requireApiUserId } from "@/lib/auth/api-user";
import {
  generateRecipeBatch,
  type PantryBridgePairPayload,
} from "@/lib/engines/recipe-generator";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const body = await request.json();
    const {
      trigger,
      targetCuisine,
      count,
      bridgePairs,
      focusIngredientIds,
      allowedCuisines,
      expiringIngredientNames,
      driftedDimensions,
    } = body as {
      trigger: string;
      targetCuisine?: string;
      count?: number;
      bridgePairs?: PantryBridgePairPayload[];
      focusIngredientIds?: string[];
      allowedCuisines?: string[];
      expiringIngredientNames?: string[];
      driftedDimensions?: Array<{
        dimension: string;
        userValue: number;
        cookbookAvg: number;
      }>;
    };

    const result = await generateRecipeBatch({
      userId,
      trigger,
      targetCuisine,
      count,
      bridgePairs,
      focusIngredientIds,
      allowedCuisines,
      expiringIngredientNames,
      driftedDimensions,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recipe generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
