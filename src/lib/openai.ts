import OpenAI from "openai";

export {
  OPENAI_MODEL_CHAT,
  OPENAI_MODEL_JSON,
  OPENAI_MODEL_VISION,
  estimateOpenAiChatCostUsd,
} from "@/lib/openai-models";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
