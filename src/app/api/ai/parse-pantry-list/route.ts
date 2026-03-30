import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parsePantryListPaste } from "@/lib/ai/pantry-list-parser";

const bodySchema = z.object({
  text: z.string().min(1).max(100_000),
});

function zodMessage(issues: z.ZodIssue[]): string {
  return issues.map((i) => i.message).join(" · ");
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error.issues), issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const items = await parsePantryListPaste(parsed.data.text);
    return NextResponse.json({ items });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to parse pantry list";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
