import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { LLMProvider } from "./llmProviders";

export function isOpenRouterProvider(provider: LLMProvider): boolean {
  return provider.baseUrl.includes("openrouter.ai");
}

export function createAIClient(provider: LLMProvider) {
  if (isOpenRouterProvider(provider)) {
    return createOpenRouter({
      apiKey: provider.apiKey,
      headers: {
        "HTTP-Referer": "https://gugugaga-learning-assistant.app",
        "X-Title": "Gugugaga Learning Assistant",
      },
    });
  }
  return createOpenAI({ baseURL: provider.baseUrl, apiKey: provider.apiKey });
}

export function getModelName(provider: LLMProvider, requireMultimodal = false): string {
  if (provider.modelName) return provider.modelName;
  // Fall back to reasonable defaults
  const providerType = provider.providerType.replace("Compatible", "").toLowerCase();
  if (providerType.includes("openai")) return "gpt-4o";
  if (providerType.includes("anthropic")) return "claude-sonnet-4-20250514";
  if (providerType.includes("google")) return "gemini-2.0-flash";
  if (providerType.includes("qwen")) return "qwen-max";
  if (providerType.includes("kimi")) return "moonshot-v1-8k";
  return "gpt-4o";
}
