import { NextRequest, NextResponse } from "next/server";
import { parseReceiptImage } from "@/lib/ai/receipt-parser";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64 } = body as { imageBase64?: string };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "imageBase64 is required" },
        { status: 400 },
      );
    }

    if (imageBase64.length > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is ~15MB." },
        { status: 400 },
      );
    }

    const parsed = await parseReceiptImage(imageBase64);

    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse receipt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
