import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { curateCookbook } from "@/lib/engines/cookbook-curator";
import { requireApiUserId } from "@/lib/auth/api-user";

const curateSchema = z.object({
  newIngredientIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUserId();
    if ("response" in auth) return auth.response;
    const { userId } = auth;

    const body = await request.json();
    const parsed = curateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 },
      );
    }
    const result = await curateCookbook(userId, {
      newIngredientIds: parsed.data.newIngredientIds,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Curation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
