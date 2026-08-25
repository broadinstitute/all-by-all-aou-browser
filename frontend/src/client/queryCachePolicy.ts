export const QUERY_CACHE_SCHEMA_VERSION = 1
export const DEFAULT_CACHE_ENABLED = true

/**
 * Only an explicit false disables the browser cache. This keeps ordinary dev
 * startup aligned with production while still allowing CACHE_ENABLED=false.
 */
export const resolveCacheEnabled = (value?: string): boolean =>
  value?.trim().toLowerCase() === 'false' ? false : DEFAULT_CACHE_ENABLED

/**
 * Build metadata is intentionally excluded. Backend data_version invalidation
 * owns data freshness; this schema number is for client cache-contract breaks.
 */
export const getQueryCacheName = (
  schemaVersion: number = QUERY_CACHE_SCHEMA_VERSION
): string => `axaou-query-cache-v${schemaVersion}`
