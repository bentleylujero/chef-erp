import { NextRequest, NextResponse } from "next/server";
import { matchRecipes } from "@/lib/engines/recipe-matcher";

const DEMO_USER_ID = "demo-user";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cuisine = searchParams.get("cuisine") ?? undefined;
  const maxDifficulty = searchParams.get("maxDifficulty");
  const maxTime = searchParams.get("maxTime");
  const limit = searchParams.get("limit");

  try {
    const results = await matchRecipes({
      userId: DEMO_USER_ID,
      targetCuisine: cuisine,
      maxDifficulty: maxDifficulty ? parseInt(maxDifficulty, 10) : undefined,
      maxTime: maxTime ? parseInt(maxTime, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return NextResponse.json({ matches: results, count: results.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to match recipes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
