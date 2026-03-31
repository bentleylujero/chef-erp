/**
 * Cost-optimized defaults: gpt-4o-mini handles JSON mode, chat, and vision in this app.
 * Override without code changes: OPENAI_MODEL_JSON | OPENAI_MODEL_CHAT | OPENAI_MODEL_VISION
 *
 * Pricing USD per 1M tokens — adjust if OpenAI changes list rates:
 * https://openai.com/api/pricing/
 */
export const OPENAI_MODEL_JSON =
  process.env.OPENAI_MODEL_JSON?.trim() || "gpt-4o-mini";
export const OPENAI_MODEL_CHAT =
  process.env.OPENAI_MODEL_CHAT?.trim() || "gpt-4o-mini";
export const OPENAI_MODEL_VISION =
  process.env.OPENAI_MODEL_VISION?.trim() || "gpt-4o-mini";

/** Per-model input/output $/1M tokens (fallback to mini rates for unknown ids). */
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1": { in: 2, out: 8 },
};

export function estimateOpenAiChatCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICE_PER_M[model] ?? PRICE_PER_M["gpt-4o-mini"];
  return (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
}
