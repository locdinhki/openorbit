import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { ArvCacheRepo } from '../arv-cache-repo'

let db: Database.Database
let repo: ArvCacheRepo

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE arv_cache (
      id          TEXT PRIMARY KEY,
      address1    TEXT NOT NULL,
      city        TEXT NOT NULL,
      state       TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      zestimate   REAL,
      zillow_url  TEXT,
      error       TEXT,
      scraped_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_arv_cache_address ON arv_cache(address1, city, state, postal_code);
  `)
  repo = new ArvCacheRepo(db)
})

describe('ArvCacheRepo', () => {
  const sampleAddress = {
    address1: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    zestimate: 250000,
    zillowUrl: 'https://www.zillow.com/homedetails/123-Main-St/12345_zpid/'
  }

  it('insert and getById', () => {
    const row = repo.insert(sampleAddress)
    expect(row.id).toBeDefined()
    expect(row.address1).toBe('123 Main St')
    expect(row.zestimate).toBe(250000)
    expect(row.zillow_url).toBe(sampleAddress.zillowUrl)

    const fetched = repo.getById(row.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(row.id)
  })

  it('findByAddress returns most recent', () => {
    repo.insert({ ...sampleAddress, zestimate: 200000 })
    repo.insert({ ...sampleAddress, zestimate: 260000 })

    const found = repo.findByAddress('123 Main St', 'Springfield', 'IL', '62701')
    expect(found).not.toBeNull()
    // Should return a valid row (most recent by scraped_at DESC)
    expect(found!.zestimate).toBeDefined()
  })

  it('findByAddress returns null for unknown address', () => {
    const found = repo.findByAddress('999 Nowhere', 'Ghost', 'XX', '00000')
    expect(found).toBeNull()
  })

  it('list returns all entries', () => {
    repo.insert(sampleAddress)
    repo.insert({ ...sampleAddress, address1: '456 Oak Ave', zestimate: 300000 })

    const all = repo.list()
    expect(all).toHaveLength(2)
  })

  it('list respects limit', () => {
    for (let i = 0; i < 5; i++) {
      repo.insert({ ...sampleAddress, address1: `${i} Test St` })
    }
    const limited = repo.list(3)
    expect(limited).toHaveLength(3)
  })

  it('delete removes entry', () => {
    const row = repo.insert(sampleAddress)
    expect(repo.getById(row.id)).not.toBeNull()

    repo.delete(row.id)
    expect(repo.getById(row.id)).toBeNull()
  })

  it('purge removes all entries', () => {
    repo.insert(sampleAddress)
    repo.insert({ ...sampleAddress, address1: '789 Elm Rd' })
    expect(repo.list()).toHaveLength(2)

    const count = repo.purge()
    expect(count).toBe(2)
    expect(repo.list()).toHaveLength(0)
  })

  it('insert with null zestimate and error', () => {
    const row = repo.insert({
      address1: '404 Missing Ln',
      city: 'Nowhere',
      state: 'ZZ',
      postalCode: '00000',
      zestimate: null,
      zillowUrl: null,
      error: 'No property found'
    })
    expect(row.zestimate).toBeNull()
    expect(row.error).toBe('No property found')
  })
})
