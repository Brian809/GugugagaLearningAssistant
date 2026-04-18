import * as SecureStore from "expo-secure-store";
import { z } from "zod";

// Zod schema for Setting
export const SettingSchema = z.object({
  apiKey: z.string(),
  baseUrl: z
    .string()
    .url()
    .or(z.string().includes("localhost"))
    .or(z.string().includes("127.0.0.1")),
  providerName: z.string(),
  providerType: z.enum([
    "anthropicCompatible",
    "openAiCompatible",
    "googleCompatible",
  ]),
  isActive: z.boolean(),
});

// Infer TypeScript type from zod schema
export type Setting = z.infer<typeof SettingSchema>;

// Schema for an array of settings
export const SettingsArraySchema = z.array(SettingSchema).refine(
  (settings) => {
    const activeCount = settings.filter((s) => s.isActive).length;
    return activeCount <= 1;
  },
  {
    message: "Only one setting can be active at a time",
  },
);

/**
 * Save settings array to secure storage.
 * @param settings - Array of Setting objects to save.
 * @returns Promise that resolves when saved successfully, rejects on error.
 */
export async function saveSettings(settings: Setting[]): Promise<void> {
  // Validate input using zod
  const validationResult = SettingsArraySchema.safeParse(settings);
  if (!validationResult.success) {
    const error = new Error(
      `Invalid settings format: ${validationResult.error.message}`,
    );
    console.error("Failed to save settings:", error);
    throw error;
  }

  try {
    const jsonString = JSON.stringify(validationResult.data);
    await SecureStore.setItemAsync("settings", jsonString);
  } catch (error) {
    console.error("Failed to save settings to SecureStore:", error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Load settings array from secure storage.
 * @returns Promise that resolves with Setting[] if valid, null if not found or invalid, rejects on storage error.
 */
export async function loadSettings(): Promise<Setting[] | null> {
  let settingsString: string | null = null;
  try {
    settingsString = await SecureStore.getItemAsync("settings");
  } catch (error) {
    console.error("Failed to load settings from SecureStore:", error);
    throw error; // Re-throw to let caller handle
  }

  if (!settingsString) {
    return null; // No settings stored
  }

  try {
    const parsed = JSON.parse(settingsString);
    const validationResult = SettingsArraySchema.safeParse(parsed);
    if (validationResult.success) {
      return validationResult.data;
    } else {
      console.error(
        "Loaded settings are not in the expected format:",
        validationResult.error.message,
      );
      return null; // Invalid format
    }
  } catch (error) {
    console.error("Failed to parse settings JSON:", error);
    return null; // Invalid JSON
  }
}

/**
 * Validate a single setting object (optional, for external use)
 */
export function validateSetting(setting: unknown): setting is Setting {
  return SettingSchema.safeParse(setting).success;
}

/**
 * Validate an array of settings (optional, for external use)
 */
export function validateSettingArray(settings: unknown): settings is Setting[] {
  return SettingsArraySchema.safeParse(settings).success;
}

/**
 * Clear all settings from secure storage.
 * @returns Promise that resolves when cleared, rejects on error.
 */
export async function clearSettings(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync("settings");
  } catch (error) {
    console.error("Failed to clear settings from SecureStore:", error);
    throw error;
  }
}

/**
 * Get the active setting (if any).
 * @returns The active Setting object, or null if none active or no settings.
 */
export async function getActiveSetting(): Promise<Setting | null> {
  const settings = await loadSettings();
  if (!settings) {
    return null;
  }
  const active = settings.find((s) => s.isActive);
  return active || null;
}

/**
 * Update a specific setting by index or condition.
 * Example: update setting at index 0 with new values.
 * @param index - Index of the setting to update.
 * @param updates - Partial Setting object with new values.
 * @returns Promise that resolves when updated, rejects on error.
 */
export async function updateSetting(
  index: number,
  updates: Partial<Setting>,
): Promise<void> {
  const settings = await loadSettings();
  if (!settings) {
    throw new Error("No settings to update");
  }
  if (index < 0 || index >= settings.length) {
    throw new Error("Index out of bounds");
  }

  // Merge updates with existing setting
  const updatedSetting = { ...settings[index], ...updates };
  const validationResult = SettingSchema.safeParse(updatedSetting);
  if (!validationResult.success) {
    throw new Error(
      `Updated setting is invalid: ${validationResult.error.message}`,
    );
  }

  const newSetting = validationResult.data;
  settings[index] = newSetting;

  // If we're activating this setting, deactivate all others
  if (newSetting.isActive) {
    settings.forEach((setting, i) => {
      if (i !== index) {
        setting.isActive = false;
      }
    });
  }

  await saveSettings(settings);
}

/**
 * Add a new setting to the array.
 * @param newSetting - The new Setting object to add.
 * @returns Promise that resolves when added, rejects on error.
 */
export async function addSetting(newSetting: Setting): Promise<void> {
  const settings = (await loadSettings()) || [];
  const validationResult = SettingSchema.safeParse(newSetting);
  if (!validationResult.success) {
    throw new Error(
      `New setting is invalid: ${validationResult.error.message}`,
    );
  }
  const validatedNewSetting = validationResult.data;
  settings.push(validatedNewSetting);

  // If we're adding an active setting, deactivate all others
  if (validatedNewSetting.isActive) {
    settings.forEach((setting, i) => {
      if (i !== settings.length - 1) {
        // The last one is the newly added
        setting.isActive = false;
      }
    });
  }

  await saveSettings(settings);
}

/**
 * Remove a setting by index.
 * @param index - Index of the setting to remove.
 * @returns Promise that resolves when removed, rejects on error.
 */
export async function removeSetting(index: number): Promise<void> {
  const settings = await loadSettings();
  if (!settings) {
    throw new Error("No settings to remove from");
  }
  if (index < 0 || index >= settings.length) {
    throw new Error("Index out of bounds");
  }
  settings.splice(index, 1);
  await saveSettings(settings);
}

/**
 * Set a specific setting as active and deactivate all others.
 * @param index - Index of the setting to activate.
 * @returns Promise that resolves when activated, rejects on error.
 */
export async function setActiveSetting(index: number): Promise<void> {
  const settings = await loadSettings();
  if (!settings) {
    throw new Error("No settings to activate");
  }
  if (index < 0 || index >= settings.length) {
    throw new Error("Index out of bounds");
  }

  // Deactivate all settings
  settings.forEach((setting, i) => {
    setting.isActive = i === index;
  });

  await saveSettings(settings);
}

/**
 * Get the index of the active setting.
 * @returns The index of the active setting, or -1 if none active or no settings.
 */
export async function getActiveSettingIndex(): Promise<number> {
  const settings = await loadSettings();
  if (!settings) {
    return -1;
  }
  return settings.findIndex((s) => s.isActive);
}
