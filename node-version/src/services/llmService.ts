import { ChatOpenAI } from "@langchain/openai";
import { LLM_BASE_URL, LLM_MODEL, LLM_PROVIDER } from "../config/env";

export function createChatModel(args: { apiKey: string }): ChatOpenAI {
  const provider = LLM_PROVIDER.trim().toLowerCase();

  if (provider !== "openai") {
    throw new Error(
      `Unsupported LLM_PROVIDER '${LLM_PROVIDER}'. Add a provider adapter in src/services/llmService.ts.`,
    );
  }

  return new ChatOpenAI({
    model: LLM_MODEL,
    apiKey: args.apiKey,
    configuration: {
      baseURL: LLM_BASE_URL,
    },
  });
}
