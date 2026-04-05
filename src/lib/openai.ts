import OpenAI from "openai";
import { env } from "@/lib/env";

export {
  OPENAI_MODEL_CHAT,
  OPENAI_MODEL_JSON,
  OPENAI_MODEL_VISION,
  estimateOpenAiChatCostUsd,
} from "@/lib/openai-models";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});
