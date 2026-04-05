import { NextRequest, NextResponse } from "next/server";
import { buildTopologyData } from "@/lib/engines/topology-builder";
import { requireApiUserId } from "@/lib/auth/api-user";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  const { searchParams } = request.nextUrl;
  const cuisine = searchParams.get("cuisine") ?? undefined;
  const pantryOnly = searchParams.get("pantryOnly") === "true";
  const minWeightParam = searchParams.get("minWeight");
  const minWeight = minWeightParam ? parseInt(minWeightParam, 10) : undefined;
  const mode = searchParams.get("mode") ?? undefined;

  try {
    const data = await buildTopologyData(userId, {
      cuisine,
      pantryOnly: pantryOnly || undefined,
      minWeight,
      mode,
    });

    return NextResponse.json(data, { headers: NO_STORE });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build food web";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE },
    );
  }
}
