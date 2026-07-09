'use client'

/**
 * lib/hooks/use-cached-fetch.ts
 *
 * Lightweight SWR-style hook for client-side data fetching with caching.
 * - Shows stale data immediately while revalidating in the background
 * - Deduplicates simultaneous requests for the same key
 * - Caches in a module-level Map (survives client-side navigation)
 * - Automatic revalidation on window focus (configurable)
 *
 * Usage:
 *   const { data, isLoading, error, revalidate } = useCachedFetch('/api/vendedor/resumo', {
 *     ttl: 60,   // seconds before data is considered stale
 *   })
 */

import { useCallback, useEffect, useRef, useState } from 'react'

type CacheEntry<T> = {
  data: T
  fetchedAt: number
}

type FetchState<T> = {
  data: T | null
  isLoading: boolean
  isValidating: boolean // background revalidation
  error: string | null
}

// Module-level cache and in-flight dedup
const memCache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

export type UseCachedFetchOptions = {
  /** Time-to-live in seconds before data is considered stale. Default: 30 */
  ttl?: number
  /** Revalidate on window focus. Default: true */
  revalidateOnFocus?: boolean
  /** Whether to skip fetching (e.g. waiting for a dynamic key). Default: false */
  skip?: boolean
  /** Custom fetch function — defaults to fetch(url, { cache: 'no-store' }) */
  fetcher?: (url: string) => Promise<unknown>
  /** Transform / validate raw response before storing */
  transform?: (raw: unknown) => unknown
}

async function defaultFetcher(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error((payload as any)?.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export function useCachedFetch<T = unknown>(
  url: string | null,
  options: UseCachedFetchOptions = {}
): FetchState<T> & { revalidate: () => void } {
  const {
    ttl = 30,
    revalidateOnFocus = true,
    skip = false,
    fetcher = defaultFetcher,
    transform,
  } = options

  const isMounted = useRef(true)

  const getCache = useCallback((): CacheEntry<T> | undefined => {
    if (!url) return undefined
    return memCache.get(url) as CacheEntry<T> | undefined
  }, [url])

  const isFresh = useCallback((): boolean => {
    const entry = getCache()
    if (!entry) return false
    return Date.now() - entry.fetchedAt < ttl * 1000
  }, [getCache, ttl])

  const [state, setState] = useState<FetchState<T>>(() => {
    // Initialise from cache if available (even if stale)
    const cached = url ? (memCache.get(url) as CacheEntry<T> | undefined) : undefined
    return {
      data: cached?.data ?? null,
      isLoading: !cached && !skip && !!url,
      isValidating: false,
      error: null,
    }
  })

  const doFetch = useCallback(
    async (isBackground = false) => {
      if (!url || skip) return

      // Deduplicate: if the same URL is already in flight, reuse that promise
      let promise = inFlight.get(url)
      if (!promise) {
        promise = fetcher(url).then((raw) => {
          const data = transform ? transform(raw) : raw
          memCache.set(url, { data, fetchedAt: Date.now() })
          inFlight.delete(url)
          return data
        }).catch((err) => {
          inFlight.delete(url)
          throw err
        })
        inFlight.set(url, promise)
      }

      if (!isBackground) {
        if (isMounted.current) {
          setState((prev) => ({ ...prev, isLoading: !prev.data, isValidating: !!prev.data, error: null }))
        }
      } else {
        if (isMounted.current) {
          setState((prev) => ({ ...prev, isValidating: true }))
        }
      }

      try {
        const data = await promise as T
        if (isMounted.current) {
          setState({ data, isLoading: false, isValidating: false, error: null })
        }
      } catch (err) {
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isValidating: false,
            error: err instanceof Error ? err.message : 'Erro ao carregar dados.',
          }))
        }
      }
    },
    [url, skip, fetcher, transform]
  )

  // Initial load / key change
  useEffect(() => {
    isMounted.current = true

    if (!url || skip) {
      setState({ data: null, isLoading: false, isValidating: false, error: null })
      return
    }

    const cached = getCache()
    if (cached) {
      // Show stale data immediately, then revalidate in background if expired
      setState({ data: cached.data, isLoading: false, isValidating: !isFresh(), error: null })
      if (!isFresh()) {
        doFetch(true) // background revalidation
      }
    } else {
      doFetch(false) // foreground load
    }

    return () => {
      isMounted.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, skip])

  // Revalidate on window focus
  useEffect(() => {
    if (!revalidateOnFocus || !url || skip) return

    const onFocus = () => {
      if (!isFresh()) {
        doFetch(true)
      }
    }

    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [revalidateOnFocus, url, skip, isFresh, doFetch])

  const revalidate = useCallback(() => {
    if (url) memCache.delete(url) // bust cache
    doFetch(false)
  }, [url, doFetch])

  return { ...state, revalidate }
}

/** Programmatically invalidate a cached URL (e.g. after a mutation). */
export function bustClientCache(url: string) {
  memCache.delete(url)
}
