import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * 跨平台存储封装
 * - iOS/Android: 使用 expo-secure-store
 * - Web: 使用 localStorage
 */

const isWeb = Platform.OS === "web";

/**
 * 安全存储项
 * @param key 存储键名
 * @param value 存储值
 */
export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
      throw error;
    }
  } else {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("Failed to save to SecureStore:", error);
      throw error;
    }
  }
}

/**
 * 获取存储项
 * @param key 存储键名
 * @returns 存储值，如果不存在则返回 null
 */
export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      throw error;
    }
  } else {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("Failed to load from SecureStore:", error);
      throw error;
    }
  }
}

/**
 * 删除存储项
 * @param key 存储键名
 */
export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to remove from localStorage:", error);
      throw error;
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("Failed to remove from SecureStore:", error);
      throw error;
    }
  }
}
