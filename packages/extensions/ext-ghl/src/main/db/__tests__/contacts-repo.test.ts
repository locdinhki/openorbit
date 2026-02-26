import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { GhlContactsRepo } from '../contacts-repo'
import type { Contact } from '../../sdk/types'

let db: Database.Database
let repo: GhlContactsRepo

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'ct_' + Math.random().toString(36).slice(2, 8),
    locationId: 'loc_001',
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+15551234567',
    companyName: 'Acme Inc',
    address1: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    tags: ['lead', 'hot'],
    customFields: [{ id: 'cf_1', value: 'test' }],
    ...overrides
  }
}

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE ghl_contacts (
      id           TEXT PRIMARY KEY,
      location_id  TEXT NOT NULL,
      first_name   TEXT,
      last_name    TEXT,
      name         TEXT,
      email        TEXT,
      phone        TEXT,
      company_name TEXT,
      address1     TEXT,
      city         TEXT,
      state        TEXT,
      postal_code  TEXT,
      tags         TEXT NOT NULL DEFAULT '[]',
      custom_fields TEXT NOT NULL DEFAULT '[]',
      raw          TEXT NOT NULL DEFAULT '{}',
      synced_at    TEXT NOT NULL DEFAULT (datetime('now')),
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_ghl_contacts_location ON ghl_contacts(location_id);
    CREATE INDEX idx_ghl_contacts_email    ON ghl_contacts(email);
  `)
  repo = new GhlContactsRepo(db)
})

describe('GhlContactsRepo', () => {
  it('upsert and getById', () => {
    const contact = makeContact({ id: 'ct_test1' })
    repo.upsert(contact)

    const row = repo.getById('ct_test1')
    expect(row).not.toBeNull()
    expect(row!.name).toBe('John Doe')
    expect(row!.email).toBe('john@example.com')
    expect(row!.location_id).toBe('loc_001')
  })

  it('upsert updates existing contact', () => {
    const contact = makeContact({ id: 'ct_update' })
    repo.upsert(contact)

    repo.upsert({ ...contact, email: 'updated@example.com', name: 'Updated Name' })

    const row = repo.getById('ct_update')
    expect(row!.email).toBe('updated@example.com')
    expect(row!.name).toBe('Updated Name')
  })

  it('getById returns null for non-existent', () => {
    expect(repo.getById('ct_nonexistent')).toBeNull()
  })

  it('list returns all contacts', () => {
    repo.upsert(makeContact({ id: 'ct_1', name: 'Alice' }))
    repo.upsert(makeContact({ id: 'ct_2', name: 'Bob' }))
    repo.upsert(makeContact({ id: 'ct_3', name: 'Charlie' }))

    const all = repo.list()
    expect(all).toHaveLength(3)
  })

  it('list with limit and offset', () => {
    for (let i = 0; i < 10; i++) {
      repo.upsert(makeContact({ id: `ct_${i}` }))
    }

    const page1 = repo.list({ limit: 3, offset: 0 })
    expect(page1).toHaveLength(3)

    const page2 = repo.list({ limit: 3, offset: 3 })
    expect(page2).toHaveLength(3)
  })

  it('list with search query matches name', () => {
    repo.upsert(makeContact({ id: 'ct_alice', name: 'Alice Smith', email: 'alice@test.com' }))
    repo.upsert(makeContact({ id: 'ct_bob', name: 'Bob Jones', email: 'bob@test.com' }))
    repo.upsert(makeContact({ id: 'ct_charlie', name: 'Charlie Brown', email: 'charlie@test.com' }))

    const results = repo.list({ query: 'Alice' })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Alice Smith')
  })

  it('list with search query matches email', () => {
    repo.upsert(makeContact({ id: 'ct_a', name: 'User A', email: 'special@acme.com' }))
    repo.upsert(
      makeContact({ id: 'ct_b', name: 'User B', email: 'normal@test.com', companyName: 'Other Co' })
    )

    const results = repo.list({ query: 'acme' })
    expect(results).toHaveLength(1)
    expect(results[0].email).toBe('special@acme.com')
  })

  it('delete removes contact', () => {
    repo.upsert(makeContact({ id: 'ct_del' }))
    expect(repo.getById('ct_del')).not.toBeNull()

    repo.delete('ct_del')
    expect(repo.getById('ct_del')).toBeNull()
  })

  it('count returns total', () => {
    expect(repo.count()).toBe(0)

    repo.upsert(makeContact({ id: 'ct_1' }))
    repo.upsert(makeContact({ id: 'ct_2' }))
    expect(repo.count()).toBe(2)

    repo.delete('ct_1')
    expect(repo.count()).toBe(1)
  })

  it('stores tags as JSON array', () => {
    repo.upsert(makeContact({ id: 'ct_tags', tags: ['vip', 'investor', 'warm'] }))

    const row = repo.getById('ct_tags')
    const tags = JSON.parse(row!.tags)
    expect(tags).toEqual(['vip', 'investor', 'warm'])
  })

  it('stores custom fields as JSON array', () => {
    repo.upsert(
      makeContact({
        id: 'ct_cf',
        customFields: [
          { id: 'cf_arv', value: 500000 },
          { id: 'cf_source', value: 'referral' }
        ]
      })
    )

    const row = repo.getById('ct_cf')
    const fields = JSON.parse(row!.custom_fields)
    expect(fields).toHaveLength(2)
    expect(fields[0].id).toBe('cf_arv')
  })
})
