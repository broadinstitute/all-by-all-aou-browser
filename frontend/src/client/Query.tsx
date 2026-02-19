const branch = process.env.BRANCH_NAME
const version = process.env.VERSION

export const pouchDbName = `axaou-${version}`

// Use local API in development, production API otherwise
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
export const axaouDevUrl = isLocalDev ? 'http://localhost:3001/api' : 'https://allbyall.researchallofus.org/api'

export const cacheEnabled = false
