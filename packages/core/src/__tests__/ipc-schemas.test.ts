import { describe, it, expect } from 'vitest'
import { ipcSchemas } from '../ipc-schemas'
import { IPC } from '../ipc-channels'

describe('IPC Schemas', () => {
  describe('all channels have schemas', () => {
    it('every IPC channel value has a corresponding schema', () => {
      const channelValues = Object.values(IPC)
      for (const channel of channelValues) {
        expect(ipcSchemas).toHaveProperty(channel)
      }
    })

    it('schema count matches channel count', () => {
      const schemaKeys = Object.keys(ipcSchemas)
      const channelValues = Object.values(IPC)
      expect(schemaKeys).toHaveLength(channelValues.length)
    })
  })

  describe('session schemas', () => {
    it('session:init accepts empty object', () => {
      expect(ipcSchemas['session:init'].safeParse({}).success).toBe(true)
    })

    it('session:login accepts platform string', () => {
      expect(ipcSchemas['session:login'].safeParse({ platform: 'linkedin' }).success).toBe(true)
    })

    it('session:login rejects missing platform', () => {
      expect(ipcSchemas['session:login'].safeParse({}).success).toBe(false)
    })
  })

  describe('browser schemas', () => {
    it('browser:navigate accepts url string', () => {
      expect(ipcSchemas['browser:navigate'].safeParse({ url: 'https://example.com' }).success).toBe(
        true
      )
    })

    it('browser:navigate rejects missing url', () => {
      expect(ipcSchemas['browser:navigate'].safeParse({}).success).toBe(false)
    })
  })

  describe('settings schemas', () => {
    it('settings:get accepts key', () => {
      expect(ipcSchemas['settings:get'].safeParse({ key: 'api_key' }).success).toBe(true)
    })

    it('settings:update accepts key and value', () => {
      expect(
        ipcSchemas['settings:update'].safeParse({ key: 'api_key', value: 'sk-123' }).success
      ).toBe(true)
    })

    it('settings:update rejects missing value', () => {
      expect(ipcSchemas['settings:update'].safeParse({ key: 'api_key' }).success).toBe(false)
    })
  })
})
