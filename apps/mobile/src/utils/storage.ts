import { Platform } from 'react-native';

/**
 * Platform-aware secure storage.
 * Uses expo-secure-store on native, localStorage on web.
 *
 * On web, supports a `?storagePrefix=` URL query param so multiple
 * iframes on the same origin can each have isolated localStorage keys
 * (e.g. `father_accessToken` vs `mother_accessToken`).
 */

let SecureStore: typeof import('expo-secure-store') | null = null;

if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

/** Read once at module load on web; empty string on native. */
let _storagePrefix = '';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  _storagePrefix = params.get('storagePrefix') || '';
}

function prefixed(key: string): string {
  return _storagePrefix + key;
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(prefixed(key));
  }
  return SecureStore!.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(prefixed(key), value);
    return;
  }
  return SecureStore!.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(prefixed(key));
    return;
  }
  return SecureStore!.deleteItemAsync(key);
}
