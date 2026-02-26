import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { exportTable } from '../main/db/data-export'
import { previewImport, executeImport } from '../main/db/data-import'

let db: Database.Database
const tmpFiles: string[] = []

function tmpPath(name: string): string {
  const p = join(tmpdir(), `ext-db-viewer-test-${Date.now()}-${name}`)
  tmpFiles.push(p)
  return p
}

beforeEach(() => {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE items (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL,
      active INTEGER DEFAULT 1,
      data TEXT
    );
    INSERT INTO items (id, name, price, active, data) VALUES (1, 'Widget', 9.99, 1, '{"color":"red"}');
    INSERT INTO items (id, name, price, active, data) VALUES (2, 'Gadget', 19.99, 0, NULL);
    INSERT INTO items (id, name, price, active, data) VALUES (3, 'Thing, "Special"', 5.50, 1, '{"tags":["a","b"]}');
  `)
})

afterEach(() => {
  for (const f of tmpFiles) {
    if (existsSync(f)) unlinkSync(f)
  }
  tmpFiles.length = 0
})

describe('exportTable', () => {
  it('exports to CSV', () => {
    const path = tmpPath('export.csv')
    const result = exportTable(db, 'items', 'csv', path)
    expect(result.rowCount).toBe(3)
    expect(existsSync(path)).toBe(true)

    const { readFileSync } = require('fs')
    const content = readFileSync(path, 'utf-8')
    const lines = content.split('\n')
    expect(lines[0]).toBe('id,name,price,active,data')
    // Check RFC 4180 escaping: commas and quotes in "Thing, "Special""
    expect(lines[3]).toContain('"Thing, ""Special"""')
  })

  it('exports to JSON', () => {
    const path = tmpPath('export.json')
    const result = exportTable(db, 'items', 'json', path)
    expect(result.rowCount).toBe(3)

    const { readFileSync } = require('fs')
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    expect(data).toHaveLength(3)
    expect(data[0].name).toBe('Widget')
  })

  it('respects row limit', () => {
    const path = tmpPath('export-limited.json')
    const result = exportTable(db, 'items', 'json', path, 2)
    expect(result.rowCount).toBe(2)
  })

  it('rejects invalid table name', () => {
    expect(() => exportTable(db, 'nonexistent', 'csv', tmpPath('x.csv'))).toThrow(
      'Invalid table name'
    )
  })
})

describe('previewImport', () => {
  it('previews a CSV file', () => {
    const path = tmpPath('import.csv')
    writeFileSync(path, 'id,name,price,active\n10,Imported,1.99,1\n11,Other,2.99,0\n', 'utf-8')

    const result = previewImport(db, 'items', path, 'csv')
    expect(result.totalRows).toBe(2)
    expect(result.columns.filter((c) => c.matched)).toHaveLength(4) // id, name, price, active
    expect(result.previewRows).toHaveLength(2)
  })

  it('warns about unmatched columns', () => {
    const path = tmpPath('import-extra.csv')
    writeFileSync(path, 'id,name,unknown_col\n10,Imported,foo\n', 'utf-8')

    const result = previewImport(db, 'items', path, 'csv')
    expect(result.warnings.some((w) => w.includes('unknown_col'))).toBe(true)
  })

  it('previews a JSON file', () => {
    const path = tmpPath('import.json')
    writeFileSync(path, JSON.stringify([{ id: 10, name: 'JsonItem', price: 3.50 }]), 'utf-8')

    const result = previewImport(db, 'items', path, 'json')
    expect(result.totalRows).toBe(1)
    expect(result.columns.some((c) => c.name === 'name' && c.matched)).toBe(true)
  })
})

describe('executeImport', () => {
  it('imports CSV data', () => {
    const path = tmpPath('import-exec.csv')
    writeFileSync(path, 'id,name,price,active\n10,CSV Item,1.99,1\n', 'utf-8')

    const result = executeImport(db, 'items', path, 'csv')
    expect(result.importedCount).toBe(1)
    expect(result.skippedCount).toBe(0)

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number }).cnt
    expect(count).toBe(4) // 3 original + 1 imported
  })

  it('imports JSON data', () => {
    const path = tmpPath('import-exec.json')
    writeFileSync(
      path,
      JSON.stringify([
        { id: 10, name: 'Json1', price: 1.0 },
        { id: 11, name: 'Json2', price: 2.0 }
      ]),
      'utf-8'
    )

    const result = executeImport(db, 'items', path, 'json')
    expect(result.importedCount).toBe(2)
  })

  it('skips rows with errors', () => {
    // Duplicate primary key will fail
    const path = tmpPath('import-dupe.json')
    writeFileSync(
      path,
      JSON.stringify([
        { id: 1, name: 'Duplicate', price: 0 } // id=1 already exists
      ]),
      'utf-8'
    )

    const result = executeImport(db, 'items', path, 'json')
    expect(result.skippedCount).toBe(1)
    expect(result.errors).toHaveLength(1)
  })

  it('ignores unmatched columns', () => {
    const path = tmpPath('import-extra.json')
    writeFileSync(
      path,
      JSON.stringify([{ id: 20, name: 'Extra', unknown_field: 'ignored' }]),
      'utf-8'
    )

    const result = executeImport(db, 'items', path, 'json')
    expect(result.importedCount).toBe(1)
  })
})
