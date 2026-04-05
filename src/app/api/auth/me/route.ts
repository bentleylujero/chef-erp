import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureAppUser,
  getSessionAuthUser,
  resolveUserId,
} from "@/lib/auth/user-service";

export async function GET() {
  const authUser = await getSessionAuthUser();

  if (authUser) {
    const user = await ensureAppUser(authUser);
    return NextResponse.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      onboardingComplete: user.onboardingComplete,
      source: "session" as const,
    });
  }

  const fallbackId = await resolveUserId();
  if (!fallbackId) {
    return NextResponse.json({ userId: null }, { status: 200 });
  }

  const user = await prisma.user.findUnique({
    where: { id: fallbackId },
    select: {
      id: true,
      email: true,
      name: true,
      onboardingComplete: true,
    },
  });

  if (!user) {
    return NextResponse.json({ userId: null }, { status: 200 });
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    name: user.name,
    onboardingComplete: user.onboardingComplete,
    source: "dev_fallback" as const,
  });
}
