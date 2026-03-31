import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkNetworkMeshGeneration } from "@/lib/engines/generation-trigger";

export const dynamic = "force-dynamic";

const DEMO_USER_ID = "demo-user";
const MESH_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export interface NetworkMeshStatus {
  canGenerate: boolean;
  reason: string;
  meshRecipeCount: number;
  hubCount: number;
  pantrySize: number;
  cooldownHoursRemaining: number | null;
}

function appOrigin(): string {
  const explicit = process.env.INTERNAL_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000";
}

export async function GET() {
  try {
    const decision = await checkNetworkMeshGeneration(DEMO_USER_ID);

    const recentMesh = await prisma.generationJob.findFirst({
      where: {
        userId: DEMO_USER_ID,
        trigger: "NETWORK_MESH",
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });

    let cooldownHoursRemaining: number | null = null;
    if (recentMesh?.completedAt) {
      const elapsed = Date.now() - recentMesh.completedAt.getTime();
      if (elapsed < MESH_COOLDOWN_MS) {
        cooldownHoursRemaining = Math.ceil(
          (MESH_COOLDOWN_MS - elapsed) / (60 * 60 * 1000),
        );
      }
    }

    const body: NetworkMeshStatus = {
      canGenerate: decision.shouldGenerate,
      reason: decision.reason,
      meshRecipeCount: decision.shouldGenerate ? decision.count : 0,
      hubCount: (decision.context.hubCount as number | undefined) ?? 0,
      pantrySize: (decision.context.pantrySize as number | undefined) ?? 0,
      cooldownHoursRemaining,
    };

    return NextResponse.json(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load network mesh";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const decision = await checkNetworkMeshGeneration(DEMO_USER_ID);
    if (!decision.shouldGenerate) {
      return NextResponse.json(
        { error: decision.reason },
        { status: 400 },
      );
    }

    const res = await fetch(`${appOrigin()}/api/ai/generate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: DEMO_USER_ID,
        trigger: decision.trigger,
        count: decision.count,
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network mesh generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
