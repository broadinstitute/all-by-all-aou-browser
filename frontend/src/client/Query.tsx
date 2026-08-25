import { getQueryCacheName, resolveCacheEnabled } from './queryCachePolicy'

export const pouchDbName = getQueryCacheName()

// Use local API in development, relative API path otherwise (for Cloud Run proxy)
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
export const axaouDevUrl = isLocalDev ? 'http://localhost:3001/api' : '/api'

export const cacheEnabled = resolveCacheEnabled(process.env.CACHE_ENABLED)
