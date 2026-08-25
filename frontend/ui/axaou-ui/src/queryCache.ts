import PouchDB from 'pouchdb'

const databaseHandles = new Map<string, PouchDB.Database>()

/** Reuse one PouchDB handle per cache instead of opening one per hook render. */
export const getQueryCacheDatabase = (name: string): PouchDB.Database => {
  const existing = databaseHandles.get(name)
  if (existing) return existing

  const database = new PouchDB(name)
  databaseHandles.set(name, database)
  return database
}

/** Destroy the shared cache and forget its now-invalid handle. */
export const destroyQueryCacheDatabase = async (name: string): Promise<void> => {
  const database = databaseHandles.get(name) ?? new PouchDB(name)
  databaseHandles.delete(name)
  await database.destroy()
}
