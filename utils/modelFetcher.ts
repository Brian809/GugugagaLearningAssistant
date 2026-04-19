import { LLMProvider } from "./llmProviders";

export interface FetchedModel {
  id: string;
  name: string;
  description?: string;
  multimodal?: boolean;
}

export interface ModelFetchResult {
  recommended: FetchedModel[];
  others: FetchedModel[];
  error?: string;
}

// 预设推荐模型映射（按提供商）
const RECOMMENDED_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o4-mini",
    "o3",
  ],
  anthropic: [
    "claude-opus-4-7-20260416",
    "claude-opus-4-6-20260217",
    "claude-sonnet-4-6-20260217",
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
  ],
  google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  qwen: [
    "qwen3.6-plus",
    "qwen3.5-plus",
    "qwen3.5-omni",
    "qwen-plus",
  ],
  kimi: [
    "kimi-k2.5",
  ],
};

/**
 * 从提供商 API 动态获取模型列表
 * 支持 OpenAI 兼容、Anthropic、Google 等格式
 */
export async function fetchModelsFromProvider(
  provider: LLMProvider
): Promise<ModelFetchResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (provider.providerType === "anthropicCompatible") {
      headers["x-api-key"] = provider.apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    let url: string;
    switch (provider.providerType) {
      case "anthropicCompatible":
        url = `${provider.baseUrl}/models`;
        break;
      case "googleCompatible":
        url = `${provider.baseUrl}/models?key=${provider.apiKey}`;
        break;
      case "openAiCompatible":
      default:
        url = `${provider.baseUrl}/models`;
        break;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return parseModels(data, provider);
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return {
      recommended: [],
      others: [],
      error: error instanceof Error ? error.message : "获取模型列表失败",
    };
  }
}

/**
 * 解析不同提供商的模型列表响应
 */
function parseModels(data: any, provider: LLMProvider): ModelFetchResult {
  const allModels: FetchedModel[] = [];

  // OpenAI 兼容格式
  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item.id) {
        allModels.push({
          id: item.id,
          name: item.id,
          description: item.description || item.object,
        });
      }
    }
  }
  // Anthropic 格式
  else if (data.models && Array.isArray(data.models)) {
    for (const item of data.models) {
      if (item.id || item.model_id) {
        allModels.push({
          id: item.id || item.model_id,
          name: item.display_name || item.id || item.model_id,
          description: item.description,
        });
      }
    }
  }
  // Google 格式
  else if (data.models && Array.isArray(data.models)) {
    for (const item of data.models) {
      if (item.name) {
        const id = item.name.replace("models/", "");
        allModels.push({
          id: id,
          name: id,
          description: item.description,
        });
      }
    }
  }

  // 根据提供商类型确定推荐模型
  const providerKey = getProviderKey(provider);
  const recommendedIds = RECOMMENDED_MODELS[providerKey] || [];

  // 分类模型
  const recommended: FetchedModel[] = [];
  const others: FetchedModel[] = [];

  for (const model of allModels) {
    const isRecommended = recommendedIds.some(
      (id) => model.id.toLowerCase().includes(id.toLowerCase()) || id.toLowerCase().includes(model.id.toLowerCase())
    );

    // 尝试判断是否为多模态模型
    const multimodalKeywords = ["vision", "multimodal", "image", "gpt-4o", "claude-3", "gemini"];
    const isMultimodal = multimodalKeywords.some((kw) =>
      model.id.toLowerCase().includes(kw.toLowerCase()) ||
      (model.description || "").toLowerCase().includes(kw.toLowerCase())
    );

    const modelWithMultimodal = { ...model, multimodal: isMultimodal };

    if (isRecommended) {
      recommended.push(modelWithMultimodal);
    } else {
      others.push(modelWithMultimodal);
    }
  }

  // 排序：推荐模型按预设顺序
  recommended.sort((a, b) => {
    const aIndex = recommendedIds.findIndex((id) =>
      a.id.toLowerCase().includes(id.toLowerCase())
    );
    const bIndex = recommendedIds.findIndex((id) =>
      b.id.toLowerCase().includes(id.toLowerCase())
    );
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return { recommended, others };
}

/**
 * 获取提供商标识键
 */
function getProviderKey(provider: LLMProvider): string {
  const baseUrl = provider.baseUrl.toLowerCase();

  if (baseUrl.includes("openai.com")) return "openai";
  if (baseUrl.includes("anthropic.com")) return "anthropic";
  if (baseUrl.includes("googleapis.com") || baseUrl.includes("generativelanguage")) return "google";
  if (baseUrl.includes("moonshot.cn")) return "kimi";
  if (baseUrl.includes("dashscope") || baseUrl.includes("aliyun")) return "qwen";
  if (baseUrl.includes("openrouter")) return "openrouter";
  if (baseUrl.includes("deepseek")) return "deepseek";
  if (baseUrl.includes("siliconflow")) return "siliconflow";

  return "openai";
}
