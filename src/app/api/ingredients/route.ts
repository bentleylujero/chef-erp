import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (category) {
    where.category = category;
  }

  try {
    const ingredients = await prisma.ingredient.findMany({
      where,
      take: 20,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(ingredients);
  } catch {
    return NextResponse.json(
      { error: "Failed to search ingredients" },
      { status: 500 },
    );
  }
}
