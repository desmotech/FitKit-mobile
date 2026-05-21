import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

/**
 * Clerk token cache backed by expo-secure-store. Without this, sessions
 * are dropped on every cold start. SecureStore values are limited to ~2KB,
 * which Clerk's session JWTs comfortably fit under.
 */
export const secureTokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch {
      // Corrupted entry — clear it and return null so Clerk re-issues.
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Swallow: a write failure surfaces to the user as a re-auth.
    }
  },
};
