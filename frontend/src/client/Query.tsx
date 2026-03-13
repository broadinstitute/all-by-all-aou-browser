const branch = process.env.BRANCH_NAME
const version = process.env.VERSION

export const pouchDbName = `axaou-${version}`

// Use local API in development, relative API path otherwise (for Cloud Run proxy)
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
export const axaouDevUrl = isLocalDev ? 'http://localhost:3001/api' : '/api'

export const cacheEnabled = false
