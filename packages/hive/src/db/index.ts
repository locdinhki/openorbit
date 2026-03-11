import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export function createDb(databaseUrl: string): {
  db: ReturnType<typeof drizzle<typeof schema>>
  client: ReturnType<typeof postgres>
} {
  const client = postgres(databaseUrl)
  const db = drizzle(client, { schema })
  return { db, client }
}

export type Db = ReturnType<typeof createDb>['db']
