import { NextRequest, NextResponse } from "next/server";
import { matchRecipes } from "@/lib/engines/recipe-matcher";
import { requireApiUserId } from "@/lib/auth/api-user";

export async function GET(request: NextRequest) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  const { searchParams } = request.nextUrl;
  const cuisine = searchParams.get("cuisine") ?? undefined;
  const maxDifficulty = searchParams.get("maxDifficulty");
  const maxTime = searchParams.get("maxTime");
  const limit = searchParams.get("limit");
  const minPantryOverlap = searchParams.get("minPantryOverlap");

  try {
    const results = await matchRecipes({
      userId,
      targetCuisine: cuisine,
      maxDifficulty: maxDifficulty ? parseInt(maxDifficulty, 10) : undefined,
      maxTime: maxTime ? parseInt(maxTime, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      minPantryOverlap: minPantryOverlap ? parseInt(minPantryOverlap, 10) : undefined,
    });

    return NextResponse.json({ matches: results, count: results.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to match recipes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
