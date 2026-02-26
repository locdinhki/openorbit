import { describe, it, expect } from 'vitest'
import { COMMANDS } from '../commands'

describe('slash commands', () => {
  it('defines expected commands', () => {
    const names = COMMANDS.map((c) => c.toJSON().name)
    expect(names).toContain('jobs')
    expect(names).toContain('approved')
    expect(names).toContain('applied')
    expect(names).toContain('profiles')
    expect(names).toContain('status')
    expect(names).toContain('log')
    expect(names).toContain('help')
  })

  it('all commands have descriptions', () => {
    for (const cmd of COMMANDS) {
      const json = cmd.toJSON()
      expect(json.description).toBeTruthy()
      expect(json.description.length).toBeGreaterThan(0)
    }
  })

  it('all command names are lowercase', () => {
    for (const cmd of COMMANDS) {
      const json = cmd.toJSON()
      expect(json.name).toMatch(/^[a-z]+$/)
    }
  })
})
