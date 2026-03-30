import { NextRequest, NextResponse } from "next/server";
import { buildTopologyData } from "@/lib/engines/topology-builder";

const DEMO_USER_ID = "demo-user";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cuisine = searchParams.get("cuisine") ?? undefined;
  const pantryOnly = searchParams.get("pantryOnly") === "true";
  const minWeightParam = searchParams.get("minWeight");
  const minWeight = minWeightParam ? parseInt(minWeightParam, 10) : undefined;

  try {
    const data = await buildTopologyData(DEMO_USER_ID, {
      cuisine,
      pantryOnly: pantryOnly || undefined,
      minWeight,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build topology";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
