import * as Storage from "./storage";
import { z } from "zod";

// Zod schema for LLM Provider
export const LLMProviderSchema = z.object({
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
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

// Schema for an array of LLM providers
export const LLMProvidersArraySchema = z.array(LLMProviderSchema).refine(
  (providers) => {
    const activeCount = providers.filter((p) => p.isActive).length;
    return activeCount <= 1;
  },
  {
    message: "Only one provider can be active at a time",
  },
);

/**
 * Save LLM providers array to secure storage.
 * @param providers - Array of LLMProvider objects to save.
 * @returns Promise that resolves when saved successfully, rejects on error.
 */
export async function saveLLMProviders(providers: LLMProvider[]): Promise<void> {
  // Validate input using zod
  const validationResult = LLMProvidersArraySchema.safeParse(providers);
  if (!validationResult.success) {
    const error = new Error(
      `Invalid providers format: ${validationResult.error.message}`,
    );
    console.error("Failed to save LLM providers:", error);
    throw error;
  }

  try {
    const jsonString = JSON.stringify(validationResult.data);
    await Storage.setItemAsync("llm-providers", jsonString);
  } catch (error) {
    console.error("Failed to save LLM providers to storage:", error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Load LLM providers array from secure storage.
 * @returns Promise that resolves with LLMProvider[] if valid, null if not found or invalid, rejects on storage error.
 */
export async function loadLLMProviders(): Promise<LLMProvider[] | null> {
  let providersString: string | null = null;
  try {
    providersString = await Storage.getItemAsync("llm-providers");
  } catch (error) {
    console.error("Failed to load LLM providers from storage:", error);
    throw error; // Re-throw to let caller handle
  }

  if (!providersString) {
    return null; // No providers stored
  }

  try {
    const parsed = JSON.parse(providersString);
    const validationResult = LLMProvidersArraySchema.safeParse(parsed);
    if (validationResult.success) {
      return validationResult.data;
    } else {
      console.error(
        "Loaded LLM providers are not in the expected format:",
        validationResult.error.message,
      );
      return null; // Invalid format
    }
  } catch (error) {
    console.error("Failed to parse LLM providers JSON:", error);
    return null; // Invalid JSON
  }
}

/**
 * Validate a single LLM provider object (optional, for external use)
 */
export function validateLLMProvider(provider: unknown): provider is LLMProvider {
  return LLMProviderSchema.safeParse(provider).success;
}

/**
 * Validate an array of LLM providers (optional, for external use)
 */
export function validateLLMProviderArray(providers: unknown): providers is LLMProvider[] {
  return LLMProvidersArraySchema.safeParse(providers).success;
}

/**
 * Clear all LLM providers from secure storage.
 * @returns Promise that resolves when cleared, rejects on error.
 */
export async function clearLLMProviders(): Promise<void> {
  try {
    await Storage.deleteItemAsync("llm-providers");
  } catch (error) {
    console.error("Failed to clear LLM providers from storage:", error);
    throw error;
  }
}

/**
 * Get the active LLM provider (if any).
 * @returns The active LLMProvider object, or null if none active or no providers.
 */
export async function getActiveLLMProvider(): Promise<LLMProvider | null> {
  const providers = await loadLLMProviders();
  if (!providers) {
    return null;
  }
  const active = providers.find((p) => p.isActive);
  return active || null;
}

/**
 * Update a specific LLM provider by index.
 * @param index - Index of the provider to update.
 * @param updates - Partial LLMProvider object with new values.
 * @returns Promise that resolves when updated, rejects on error.
 */
export async function updateLLMProvider(
  index: number,
  updates: Partial<LLMProvider>,
): Promise<void> {
  const providers = await loadLLMProviders();
  if (!providers) {
    throw new Error("No LLM providers to update");
  }
  if (index < 0 || index >= providers.length) {
    throw new Error("Index out of bounds");
  }

  const updatedProvider = { ...providers[index], ...updates };
  const validationResult = LLMProviderSchema.safeParse(updatedProvider);
  if (!validationResult.success) {
    throw new Error(
      `Invalid provider data: ${validationResult.error.message}`,
    );
  }

  providers[index] = validationResult.data;

  // If activating this provider, deactivate others
  if (updates.isActive) {
    providers.forEach((p, i) => {
      if (i !== index) {
        p.isActive = false;
      }
    });
  }

  await saveLLMProviders(providers);
}

/**
 * Add a new LLM provider.
 * @param provider - LLMProvider object to add.
 * @returns Promise that resolves when added, rejects on error.
 */
export async function addLLMProvider(provider: LLMProvider): Promise<void> {
  const validationResult = LLMProviderSchema.safeParse(provider);
  if (!validationResult.success) {
    throw new Error(
      `Invalid provider data: ${validationResult.error.message}`,
    );
  }

  const providers = (await loadLLMProviders()) || [];
  const validatedProvider = validationResult.data;

  // If activating this provider, deactivate others
  if (validatedProvider.isActive) {
    providers.forEach((p) => {
      p.isActive = false;
    });
  }

  providers.push(validatedProvider);
  await saveLLMProviders(providers);
}

/**
 * Remove a LLM provider by index.
 * @param index - Index of the provider to remove.
 * @returns Promise that resolves when removed, rejects on error.
 */
export async function removeLLMProvider(index: number): Promise<void> {
  const providers = await loadLLMProviders();
  if (!providers) {
    throw new Error("No LLM providers to remove");
  }
  if (index < 0 || index >= providers.length) {
    throw new Error("Index out of bounds");
  }

  providers.splice(index, 1);
  await saveLLMProviders(providers);
}

/**
 * Set a specific LLM provider as active by index.
 * @param index - Index of the provider to activate.
 * @returns Promise that resolves when activated, rejects on error.
 */
export async function setActiveLLMProvider(index: number): Promise<void> {
  const providers = await loadLLMProviders();
  if (!providers) {
    throw new Error("No LLM providers to activate");
  }
  if (index < 0 || index >= providers.length) {
    throw new Error("Index out of bounds");
  }

  providers.forEach((p, i) => {
    p.isActive = i === index;
  });

  await saveLLMProviders(providers);
}
