import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  queryTableData,
  updateRecord,
  insertRecord,
  deleteRecord,
  executeSql
} from '../main/db/query-executor'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      age INTEGER DEFAULT 0,
      metadata TEXT
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT INTO users (id, name, email, age, metadata) VALUES (1, 'Alice', 'alice@test.com', 30, '{"role":"admin"}');
    INSERT INTO users (id, name, email, age, metadata) VALUES (2, 'Bob', 'bob@test.com', 25, NULL);
    INSERT INTO users (id, name, email, age, metadata) VALUES (3, 'Charlie', 'charlie@test.com', 35, '{"role":"user"}');
    INSERT INTO users (id, name, email, age, metadata) VALUES (4, 'Diana', 'diana@test.com', 28, NULL);
    INSERT INTO users (id, name, email, age, metadata) VALUES (5, 'Eve', 'eve@test.com', 32, NULL);
  `)
})

describe('queryTableData', () => {
  it('returns paginated data', () => {
    const result = queryTableData(db, { table: 'users', page: 1, pageSize: 3 })
    expect(result.rows).toHaveLength(3)
    expect(result.totalCount).toBe(5)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(3)
  })

  it('handles page 2', () => {
    const result = queryTableData(db, { table: 'users', page: 2, pageSize: 3 })
    expect(result.rows).toHaveLength(2)
    expect(result.totalCount).toBe(5)
  })

  it('sorts ascending', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      sortColumn: 'age',
      sortDirection: 'asc'
    })
    const ages = result.rows.map((r) => r.age as number)
    expect(ages).toEqual([25, 28, 30, 32, 35])
  })

  it('sorts descending', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      sortColumn: 'name',
      sortDirection: 'desc'
    })
    const names = result.rows.map((r) => r.name)
    expect(names).toEqual(['Eve', 'Diana', 'Charlie', 'Bob', 'Alice'])
  })

  it('filters with eq operator', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      filters: [{ column: 'name', operator: 'eq', value: 'Alice' }]
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].name).toBe('Alice')
    expect(result.totalCount).toBe(1)
  })

  it('filters with like operator', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      filters: [{ column: 'email', operator: 'like', value: 'bob' }]
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].name).toBe('Bob')
  })

  it('filters with gt operator', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      filters: [{ column: 'age', operator: 'gt', value: '30' }]
    })
    expect(result.rows).toHaveLength(2) // Charlie (35), Eve (32)
  })

  it('filters with is-null operator', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      filters: [{ column: 'metadata', operator: 'is-null' }]
    })
    expect(result.rows).toHaveLength(3) // Bob, Diana, Eve
  })

  it('filters with not-null operator', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      filters: [{ column: 'metadata', operator: 'not-null' }]
    })
    expect(result.rows).toHaveLength(2) // Alice, Charlie
  })

  it('combines multiple filters', () => {
    const result = queryTableData(db, {
      table: 'users',
      page: 1,
      pageSize: 50,
      filters: [
        { column: 'age', operator: 'gte', value: '28' },
        { column: 'age', operator: 'lte', value: '32' }
      ]
    })
    expect(result.rows).toHaveLength(3) // Alice (30), Diana (28), Eve (32)
  })

  it('rejects invalid table names', () => {
    expect(() => queryTableData(db, { table: 'nonexistent', page: 1, pageSize: 50 })).toThrow(
      'Invalid table name'
    )
  })

  it('rejects invalid column names in sort', () => {
    expect(() =>
      queryTableData(db, {
        table: 'users',
        page: 1,
        pageSize: 50,
        sortColumn: 'nonexistent',
        sortDirection: 'asc'
      })
    ).toThrow('Invalid column name')
  })

  it('rejects invalid column names in filters', () => {
    expect(() =>
      queryTableData(db, {
        table: 'users',
        page: 1,
        pageSize: 50,
        filters: [{ column: 'nonexistent', operator: 'eq', value: 'x' }]
      })
    ).toThrow('Invalid column name')
  })
})

describe('updateRecord', () => {
  it('updates a record by primary key', () => {
    const affected = updateRecord(db, 'users', { id: 1 }, { name: 'Alice Updated', age: 31 })
    expect(affected).toBe(1)

    const row = db.prepare('SELECT * FROM users WHERE id = 1').get() as Record<string, unknown>
    expect(row.name).toBe('Alice Updated')
    expect(row.age).toBe(31)
  })

  it('returns 0 for non-matching primary key', () => {
    const affected = updateRecord(db, 'users', { id: 999 }, { name: 'Nobody' })
    expect(affected).toBe(0)
  })
})

describe('insertRecord', () => {
  it('inserts a new record', () => {
    const lastId = insertRecord(db, 'users', {
      id: 6,
      name: 'Frank',
      email: 'frank@test.com',
      age: 40
    })
    expect(lastId).toBe(6)

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
    expect(count).toBe(6)
  })

  it('inserts with auto-increment', () => {
    const lastId = insertRecord(db, 'users', { name: 'Grace', email: 'grace@test.com' })
    expect(typeof lastId).toBe('number')
    expect(Number(lastId)).toBeGreaterThan(5)
  })
})

describe('deleteRecord', () => {
  it('deletes a record by primary key', () => {
    const affected = deleteRecord(db, 'users', { id: 1 })
    expect(affected).toBe(1)

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
    expect(count).toBe(4)
  })

  it('returns 0 for non-matching primary key', () => {
    const affected = deleteRecord(db, 'users', { id: 999 })
    expect(affected).toBe(0)
  })
})

describe('executeSql', () => {
  it('executes SELECT queries', () => {
    const result = executeSql(db, 'SELECT * FROM users WHERE age > 30')
    expect(result.statementType).toBe('SELECT')
    expect(result.rows).toHaveLength(2) // Charlie (35), Eve (32)
    expect(result.columns).toContain('name')
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('adds LIMIT safeguard to unbounded SELECTs', () => {
    const result = executeSql(db, 'SELECT * FROM users')
    // Should still work, just auto-limited to 1000
    expect(result.rows.length).toBeLessThanOrEqual(1000)
    expect(result.statementType).toBe('SELECT')
  })

  it('preserves explicit LIMIT clause', () => {
    const result = executeSql(db, 'SELECT * FROM users LIMIT 2')
    expect(result.rows).toHaveLength(2)
  })

  it('executes INSERT statements', () => {
    const result = executeSql(db, "INSERT INTO settings (key, value) VALUES ('test', 'val')")
    expect(result.statementType).toBe('INSERT')
    expect(result.rowsAffected).toBe(1)
    expect(result.columns).toHaveLength(0)
  })

  it('executes UPDATE statements', () => {
    const result = executeSql(db, "UPDATE users SET age = 99 WHERE name = 'Alice'")
    expect(result.statementType).toBe('UPDATE')
    expect(result.rowsAffected).toBe(1)
  })

  it('throws on invalid SQL', () => {
    expect(() => executeSql(db, 'INVALID SQL')).toThrow()
  })

  it('supports parameterized queries', () => {
    const result = executeSql(db, 'SELECT * FROM users WHERE name = ?', ['Alice'])
    expect(result.rows).toHaveLength(1)
  })
})
