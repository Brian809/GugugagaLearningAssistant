import { create } from "zustand";
import {
  LLMProvider,
  LLMProviderSchema,
  LLMProvidersArraySchema,
} from "../utils/llmProviders";
import * as Storage from "../utils/storage";

interface LLMProviderStore {
  // 状态
  providers: LLMProvider[];
  activeProvider: LLMProvider | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProviders: () => Promise<void>;
  addProvider: (newProvider: LLMProvider) => Promise<void>;
  updateProvider: (index: number, updates: Partial<LLMProvider>) => Promise<void>;
  removeProvider: (index: number) => Promise<void>;
  setActiveProvider: (index: number) => Promise<void>;
  clearProviders: () => Promise<void>;
  setError: (error: string | null) => void;
  saveToStorage: () => Promise<void>;
}

export const useLLMProviderStore = create<LLMProviderStore>((set, get) => ({
  // 初始状态
  providers: [],
  activeProvider: null,
  isLoading: false,
  error: null,

  // 加载供应商
  loadProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const providersString = await Storage.getItemAsync("llm-providers");
      if (providersString) {
        const parsed = JSON.parse(providersString);
        const validationResult = LLMProvidersArraySchema.safeParse(parsed);
        if (validationResult.success) {
          const providers = validationResult.data;
          const active = providers.find((p) => p.isActive) || null;
          set({ providers, activeProvider: active });
        } else {
          throw new Error(
            `Invalid providers format: ${validationResult.error.message}`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      console.error("Failed to load LLM providers:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  // 添加新供应商
  addProvider: async (newProvider: LLMProvider) => {
    const validationResult = LLMProviderSchema.safeParse(newProvider);
    if (!validationResult.success) {
      throw new Error(
        `New provider is invalid: ${validationResult.error.message}`,
      );
    }

    const validatedProvider = validationResult.data;
    set((state) => {
      let updatedProviders = [...state.providers, validatedProvider];

      // 如果新供应商是活跃的，则将其它供应商设为非活跃
      if (validatedProvider.isActive) {
        updatedProviders = updatedProviders.map((provider, index) => ({
          ...provider,
          isActive: index === updatedProviders.length - 1,
        }));
      }

      const active = updatedProviders.find((p) => p.isActive) || null;
      return { providers: updatedProviders, activeProvider: active };
    });

    // 保存到存储
    await get().saveToStorage();
  },

  // 更新指定索引的供应商
  updateProvider: async (index: number, updates: Partial<LLMProvider>) => {
    const { providers } = get();
    if (index < 0 || index >= providers.length) {
      throw new Error("Index out of bounds");
    }

    const updatedProvider = { ...providers[index], ...updates };
    const validationResult = LLMProviderSchema.safeParse(updatedProvider);
    if (!validationResult.success) {
      throw new Error(
        `Updated provider is invalid: ${validationResult.error.message}`,
      );
    }

    const validatedProvider = validationResult.data;
    set((state) => {
      const updatedProviders = [...state.providers];
      updatedProviders[index] = validatedProvider;

      // 如果激活了此供应商，则将其它供应商设为非活跃
      if (validatedProvider.isActive) {
        updatedProviders.forEach((provider, i) => {
          if (i !== index) {
            provider.isActive = false;
          }
        });
      }

      const active = updatedProviders.find((p) => p.isActive) || null;
      return { providers: updatedProviders, activeProvider: active };
    });

    // 保存到存储
    await get().saveToStorage();
  },

  // 删除指定索引的供应商
  removeProvider: async (index: number) => {
    const { providers } = get();
    if (index < 0 || index >= providers.length) {
      throw new Error("Index out of bounds");
    }

    set((state) => {
      const updatedProviders = state.providers.filter((_, i) => i !== index);
      const active = updatedProviders.find((p) => p.isActive) || null;
      return { providers: updatedProviders, activeProvider: active };
    });

    // 保存到存储
    await get().saveToStorage();
  },

  // 设置指定索引为活跃
  setActiveProvider: async (index: number) => {
    const { providers } = get();
    if (index < 0 || index >= providers.length) {
      throw new Error("Index out of bounds");
    }

    set((state) => {
      const updatedProviders = state.providers.map((provider, i) => ({
        ...provider,
        isActive: i === index,
      }));
      const active = updatedProviders[index];
      return { providers: updatedProviders, activeProvider: active };
    });

    // 保存到存储
    await get().saveToStorage();
  },

  // 清除所有供应商
  clearProviders: async () => {
    set({ providers: [], activeProvider: null });
    await Storage.deleteItemAsync("llm-providers");
  },

  // 设置错误
  setError: (error: string | null) => {
    set({ error });
  },

  // 内部方法：保存到存储
  saveToStorage: async () => {
    const { providers } = get();
    const validationResult = LLMProvidersArraySchema.safeParse(providers);
    if (!validationResult.success) {
      throw new Error(
        `Cannot save invalid providers: ${validationResult.error.message}`,
      );
    }

    try {
      const jsonString = JSON.stringify(providers);
      await Storage.setItemAsync("llm-providers", jsonString);
    } catch (error) {
      console.error("Failed to save LLM providers to storage:", error);
      throw error;
    }
  },
}));

// 导出一些常用的钩子
export const useLLMProviders = () => useLLMProviderStore((state) => state.providers);
export const useActiveLLMProvider = () =>
  useLLMProviderStore((state) => state.activeProvider);
export const useLLMProvidersLoading = () =>
  useLLMProviderStore((state) => state.isLoading);
export const useLLMProvidersError = () => useLLMProviderStore((state) => state.error);
