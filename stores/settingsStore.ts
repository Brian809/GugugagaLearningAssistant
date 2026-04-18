import { create } from "zustand";
import { Setting, SettingSchema, SettingsArraySchema } from "../utils/settings";
import * as SecureStore from "expo-secure-store";

interface SettingsStore {
  // 状态
  settings: Setting[];
  activeSetting: Setting | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  addSetting: (newSetting: Setting) => Promise<void>;
  updateSetting: (index: number, updates: Partial<Setting>) => Promise<void>;
  removeSetting: (index: number) => Promise<void>;
  setActiveSetting: (index: number) => Promise<void>;
  clearSettings: () => Promise<void>;
  setError: (error: string | null) => void;
  saveToSecureStore: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // 初始状态
  settings: [],
  activeSetting: null,
  isLoading: false,
  error: null,

  // 加载设置
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settingsString = await SecureStore.getItemAsync("settings");
      if (settingsString) {
        const parsed = JSON.parse(settingsString);
        const validationResult = SettingsArraySchema.safeParse(parsed);
        if (validationResult.success) {
          const settings = validationResult.data;
          const active = settings.find((s) => s.isActive) || null;
          set({ settings, activeSetting: active });
        } else {
          throw new Error(
            `Invalid settings format: ${validationResult.error.message}`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      console.error("Failed to load settings:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  // 添加新设置
  addSetting: async (newSetting: Setting) => {
    const validationResult = SettingSchema.safeParse(newSetting);
    if (!validationResult.success) {
      throw new Error(
        `New setting is invalid: ${validationResult.error.message}`,
      );
    }

    const validatedSetting = validationResult.data;
    set((state) => {
      let updatedSettings = [...state.settings, validatedSetting];

      // 如果新设置是活跃的，则将其它设置设为非活跃
      if (validatedSetting.isActive) {
        updatedSettings = updatedSettings.map((setting, index) => ({
          ...setting,
          isActive: index === updatedSettings.length - 1,
        }));
      }

      const active = updatedSettings.find((s) => s.isActive) || null;
      return { settings: updatedSettings, activeSetting: active };
    });

    // 保存到SecureStore
    await get().saveToSecureStore();
  },

  // 更新指定索引的设置
  updateSetting: async (index: number, updates: Partial<Setting>) => {
    const { settings } = get();
    if (index < 0 || index >= settings.length) {
      throw new Error("Index out of bounds");
    }

    const updatedSetting = { ...settings[index], ...updates };
    const validationResult = SettingSchema.safeParse(updatedSetting);
    if (!validationResult.success) {
      throw new Error(
        `Updated setting is invalid: ${validationResult.error.message}`,
      );
    }

    const validatedSetting = validationResult.data;
    set((state) => {
      const updatedSettings = [...state.settings];
      updatedSettings[index] = validatedSetting;

      // 如果激活了此设置，则将其它设置设为非活跃
      if (validatedSetting.isActive) {
        updatedSettings.forEach((setting, i) => {
          if (i !== index) {
            setting.isActive = false;
          }
        });
      }

      const active = updatedSettings.find((s) => s.isActive) || null;
      return { settings: updatedSettings, activeSetting: active };
    });

    // 保存到SecureStore
    await get().saveToSecureStore();
  },

  // 删除指定索引的设置
  removeSetting: async (index: number) => {
    const { settings } = get();
    if (index < 0 || index >= settings.length) {
      throw new Error("Index out of bounds");
    }

    set((state) => {
      const updatedSettings = state.settings.filter((_, i) => i !== index);
      const active = updatedSettings.find((s) => s.isActive) || null;
      return { settings: updatedSettings, activeSetting: active };
    });

    // 保存到SecureStore
    await get().saveToSecureStore();
  },

  // 设置指定索引为活跃
  setActiveSetting: async (index: number) => {
    const { settings } = get();
    if (index < 0 || index >= settings.length) {
      throw new Error("Index out of bounds");
    }

    set((state) => {
      const updatedSettings = state.settings.map((setting, i) => ({
        ...setting,
        isActive: i === index,
      }));
      const active = updatedSettings[index];
      return { settings: updatedSettings, activeSetting: active };
    });

    // 保存到SecureStore
    await get().saveToSecureStore();
  },

  // 清除所有设置
  clearSettings: async () => {
    set({ settings: [], activeSetting: null });
    await SecureStore.deleteItemAsync("settings");
  },

  // 设置错误
  setError: (error: string | null) => {
    set({ error });
  },

  // 内部方法：保存到SecureStore
  saveToSecureStore: async () => {
    const { settings } = get();
    const validationResult = SettingsArraySchema.safeParse(settings);
    if (!validationResult.success) {
      throw new Error(
        `Cannot save invalid settings: ${validationResult.error.message}`,
      );
    }

    try {
      const jsonString = JSON.stringify(settings);
      await SecureStore.setItemAsync("settings", jsonString);
    } catch (error) {
      console.error("Failed to save settings to SecureStore:", error);
      throw error;
    }
  },
}));

// 导出一些常用的钩子
export const useSettings = () => useSettingsStore((state) => state.settings);
export const useActiveSetting = () =>
  useSettingsStore((state) => state.activeSetting);
export const useSettingsLoading = () =>
  useSettingsStore((state) => state.isLoading);
export const useSettingsError = () => useSettingsStore((state) => state.error);
