import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { updateFlavorProfileFromSignals } from "@/lib/engines/preference-aggregator";
import { curateCookbook } from "@/lib/engines/cookbook-curator";
import { requireApiUserId } from "@/lib/auth/api-user";

const preferenceSignalSchema = z.object({
  signalType: z.enum([
    "COOKED",
    "RATED",
    "SKIPPED",
    "FAVORITED",
    "UNFAVORITED",
    "PURCHASED",
    "ADDED_TO_PLAN",
    "REMOVED_FROM_PLAN",
    "SEARCHED",
  ]),
  entityType: z.enum(["RECIPE", "INGREDIENT"]),
  entityId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const body = await request.json();
    const parsed = preferenceSignalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }

    const { signalType, entityType, entityId, metadata } = parsed.data;

    const signal = await prisma.preferenceSignal.create({
      data: {
        userId,
        signalType,
        entityType,
        entityId,
        metadata: (metadata ?? {}) as any,
      },
    });

    if (signalType === "COOKED" || signalType === "RATED") {
      await updateFlavorProfileFromSignals(userId);
    }

    // High-signal events may shift preferences enough to trigger cookbook curation
    const HIGH_SIGNAL = new Set(["COOKED", "RATED", "FAVORITED"]);
    if (HIGH_SIGNAL.has(signalType)) {
      after(async () => {
        try {
          await curateCookbook(userId);
        } catch {
          // Fire-and-forget
        }
      });
    }

    return NextResponse.json(signal, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to log preference signal" },
      { status: 500 },
    );
  }
}
