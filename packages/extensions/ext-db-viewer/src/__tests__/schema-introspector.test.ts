import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { listTables, getColumns, getIndexes, getPrimaryKey, validateTableName, isVirtualTable } from '../main/db/schema-introspector'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      age INTEGER DEFAULT 0
    );
    CREATE INDEX idx_users_email ON users(email);
    CREATE UNIQUE INDEX idx_users_name ON users(name);

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL
    );

    INSERT INTO users (id, name, email, age) VALUES (1, 'Alice', 'alice@test.com', 30);
    INSERT INTO users (id, name, email, age) VALUES (2, 'Bob', 'bob@test.com', 25);
  `)
})

describe('listTables', () => {
  it('lists all tables with row counts', () => {
    const tables = listTables(db)
    expect(tables.length).toBeGreaterThanOrEqual(3)

    const usersTable = tables.find((t) => t.name === 'users')
    expect(usersTable).toBeDefined()
    expect(usersTable!.rowCount).toBe(2)
    expect(usersTable!.type).toBe('table')
    expect(usersTable!.isSystem).toBe(false)
  })

  it('marks system tables', () => {
    const tables = listTables(db)
    const migrations = tables.find((t) => t.name === '_migrations')
    expect(migrations).toBeDefined()
    expect(migrations!.isSystem).toBe(true)
  })

  it('handles empty database', () => {
    const emptyDb = new Database(':memory:')
    const tables = listTables(emptyDb)
    expect(tables).toHaveLength(0)
  })
})

describe('getColumns', () => {
  it('returns column info for a table', () => {
    const columns = getColumns(db, 'users')
    expect(columns).toHaveLength(4)

    const idCol = columns.find((c) => c.name === 'id')
    expect(idCol).toBeDefined()
    expect(idCol!.isPrimaryKey).toBe(true)
    expect(idCol!.type).toBe('INTEGER')

    const nameCol = columns.find((c) => c.name === 'name')
    expect(nameCol).toBeDefined()
    expect(nameCol!.notnull).toBe(true)

    const ageCol = columns.find((c) => c.name === 'age')
    expect(ageCol).toBeDefined()
    expect(ageCol!.defaultValue).toBe('0')
  })

  it('throws for invalid table name', () => {
    expect(() => getColumns(db, 'nonexistent')).toThrow('Invalid table name')
  })
})

describe('getIndexes', () => {
  it('returns index info for a table', () => {
    const indexes = getIndexes(db, 'users')
    expect(indexes.length).toBeGreaterThanOrEqual(2)

    const emailIdx = indexes.find((i) => i.name === 'idx_users_email')
    expect(emailIdx).toBeDefined()
    expect(emailIdx!.unique).toBe(false)
    expect(emailIdx!.columns).toContain('email')

    const nameIdx = indexes.find((i) => i.name === 'idx_users_name')
    expect(nameIdx).toBeDefined()
    expect(nameIdx!.unique).toBe(true)
  })
})

describe('getPrimaryKey', () => {
  it('returns primary key columns', () => {
    const pk = getPrimaryKey(db, 'users')
    expect(pk).toEqual(['id'])
  })

  it('returns composite primary key', () => {
    db.exec(`
      CREATE TABLE composite_pk (
        a TEXT NOT NULL,
        b TEXT NOT NULL,
        c TEXT,
        PRIMARY KEY (a, b)
      )
    `)
    const pk = getPrimaryKey(db, 'composite_pk')
    expect(pk).toEqual(['a', 'b'])
  })

  it('falls back to rowid for tables without explicit PK', () => {
    db.exec('CREATE TABLE no_pk (name TEXT, value TEXT)')
    const pk = getPrimaryKey(db, 'no_pk')
    expect(pk).toEqual(['rowid'])
  })
})

describe('validateTableName', () => {
  it('succeeds for valid table names', () => {
    expect(() => validateTableName(db, 'users')).not.toThrow()
    expect(() => validateTableName(db, 'settings')).not.toThrow()
  })

  it('throws for invalid table names', () => {
    expect(() => validateTableName(db, 'nonexistent')).toThrow('Invalid table name')
    expect(() => validateTableName(db, 'users; DROP TABLE users')).toThrow('Invalid table name')
  })
})

describe('isVirtualTable', () => {
  it('returns false for regular tables', () => {
    expect(isVirtualTable(db, 'users')).toBe(false)
  })
})
