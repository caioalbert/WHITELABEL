/**
 * lib/server-cache.ts
 *
 * Simple in-memory TTL cache for Next.js API route handlers.
 * Shares state across requests within the same server process.
 *
 * Usage:
 *   const data = await serverCache('key', 120, () => fetchExpensiveData())
 */

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

// Module-level Map persists across requests within the same process
const store = new Map<string, CacheEntry<unknown>>()

/**
 * Returns cached value if still valid, otherwise calls `fn`, caches, and returns the result.
 * @param key       - Unique cache key
 * @param ttl       - Time-to-live in seconds
 * @param fn        - Async function to compute the value on miss
 */
export async function serverCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const entry = store.get(key) as CacheEntry<T> | undefined

  if (entry && entry.expiresAt > now) {
    return entry.data
  }

  const data = await fn()
  store.set(key, { data, expiresAt: now + ttl * 1000 })
  return data
}

/**
 * Invalidate one or more cache keys by prefix or exact match.
 * Pass a prefix (e.g. 'planos') to clear all keys that start with it.
 */
export function invalidateCache(keyOrPrefix: string) {
  for (const key of store.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix + ':')) {
      store.delete(key)
    }
  }
}

/** Invalidate ALL cached entries. */
export function clearAllCache() {
  store.clear()
}
