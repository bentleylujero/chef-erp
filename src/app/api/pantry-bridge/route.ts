import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUnlinkedPantryIngredients } from "@/lib/engines/topology-builder";
import {
  pickBridgePairsForGeneration,
  rankPantryBridgePairs,
} from "@/lib/engines/pantry-bridge-heuristics";
import { checkPantryBridgeGeneration } from "@/lib/engines/generation-trigger";
import { requireApiUserId } from "@/lib/auth/api-user";

export const dynamic = "force-dynamic";

function appOrigin(): string {
  const explicit = process.env.INTERNAL_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000";
}

export async function GET() {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const {
      unlinked,
      linkedCorpusPantry,
      totalPantryWithStock,
      linkedPantryCount,
    } = await getUnlinkedPantryIngredients(userId);

    const attempts = await prisma.pantryBridgeAttempt.findMany({
      where: { userId },
      select: { ingredientAId: true, ingredientBId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const attempted = new Set(
      attempts.map((a) => `${a.ingredientAId}::${a.ingredientBId}`),
    );

    const ranked = rankPantryBridgePairs(
      unlinked,
      attempted,
      linkedCorpusPantry,
    );
    const unlinkedIds = new Set(unlinked.map((u) => u.id));
    const nextBatchPairs = pickBridgePairsForGeneration(
      ranked,
      unlinkedIds,
      5,
    );

    return NextResponse.json({
      unlinked,
      unlinkedCount: unlinked.length,
      linkedCorpusPantryCount: linkedCorpusPantry.length,
      totalPantryWithStock,
      linkedPantryCount,
      suggestedPairs: ranked.slice(0, 14),
      nextBatchPairs,
      novelPairCount: ranked.length,
      bridgeAttemptsLogged: attempts.length,
      canGenerate: nextBatchPairs.length > 0,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load pantry bridge";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const decision = await checkPantryBridgeGeneration(userId);
    if (!decision.shouldGenerate) {
      return NextResponse.json(
        { error: decision.reason },
        { status: 400 },
      );
    }

    const res = await fetch(`${appOrigin()}/api/ai/generate-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        trigger: decision.trigger,
        count: decision.count,
        bridgePairs: decision.context.bridgePairs,
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Pantry bridge generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
