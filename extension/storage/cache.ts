// storage/cache.ts
// Chrome storage wrapper for caching analysis results.
// Uses chrome.storage.local to avoid re-analyzing the same domain repeatedly.

import { AnalysisResult, CachedAnalysis } from '../shared/types';

const CACHE_PREFIX = 'ctip_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Build the storage key for a domain.
 */
function cacheKey(domain: string): string {
  return `${CACHE_PREFIX}${domain.toLowerCase()}`;
}

/**
 * Retrieve a cached analysis result for the given domain.
 * Returns null if not found or expired.
 */
export async function getCachedResult(domain: string): Promise<CachedAnalysis | null> {
  const key = cacheKey(domain);
  const data = await chrome.storage.local.get(key);
  const entry: CachedAnalysis | undefined = data[key];

  if (!entry) return null;

  // Check TTL
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  if (age > CACHE_TTL_MS) {
    // Expired — clean up
    await chrome.storage.local.remove(key);
    return null;
  }

  return entry;
}

/**
 * Store an analysis result for the given domain.
 */
export async function setCachedResult(domain: string, result: AnalysisResult): Promise<void> {
  const key = cacheKey(domain);
  const entry: CachedAnalysis = {
    domain: domain.toLowerCase(),
    result,
    cachedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [key]: entry });
}

/**
 * Remove cached entry for a single domain.
 */
export async function removeCachedResult(domain: string): Promise<void> {
  const key = cacheKey(domain);
  await chrome.storage.local.remove(key);
}

/**
 * Clear all CTIP cache entries.
 */
export async function clearCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}
