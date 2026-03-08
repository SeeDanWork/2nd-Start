import crypto from 'crypto';

interface CacheEntry {
  response: string;
  timestamp: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 1000;

const cache = new Map<string, CacheEntry>();

export function getCacheKey(prompt: string, taskType: string): string {
  return crypto
    .createHash('sha256')
    .update(`${taskType}:${prompt}`)
    .digest('hex');
}

export function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCache(key: string, response: string): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { response, timestamp: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}

export function cacheStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: MAX_ENTRIES };
}
