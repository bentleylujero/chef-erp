import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODEL_CHAT } from "@/lib/openai";
import { buildSousChefSystemPrompt } from "@/lib/ai/chat-system-prompt";

export async function POST(request: NextRequest) {
  try {
    const { messages, userId } = (await request.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      userId: string;
    };

    if (!userId || !messages?.length) {
      return NextResponse.json(
        { error: "userId and messages are required" },
        { status: 400 },
      );
    }

    const systemPrompt = await buildSousChefSystemPrompt(userId);

    const stream = await openai.chat.completions.create({
      model: OPENAI_MODEL_CHAT,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      stream: true,
      temperature: 0.55,
      max_tokens: 1200,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
