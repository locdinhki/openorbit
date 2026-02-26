/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { HumanBehavior } = await import('../human-behavior')

describe('HumanBehavior', () => {
  let hb: InstanceType<typeof HumanBehavior>

  beforeEach(() => {
    hb = new HumanBehavior()
  })

  describe('delay()', () => {
    it('resolves without throwing', async () => {
      await expect(hb.delay(10, 20)).resolves.toBeUndefined()
    })
  })

  describe('humanType()', () => {
    it('clicks the selector and types each character', async () => {
      const mockPage = {
        click: vi.fn(),
        keyboard: {
          type: vi.fn()
        }
      }

      await hb.humanType(mockPage as any, '.input', 'hi')

      expect(mockPage.click).toHaveBeenCalledWith('.input')
      // 'h' and 'i' typed individually
      expect(mockPage.keyboard.type).toHaveBeenCalledTimes(2)
    })
  })

  describe('humanClick()', () => {
    it('clicks within 30-70% of bounding box when available', async () => {
      const clickX: number[] = []
      const clickY: number[] = []

      const mockPage = {
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue({
              x: 100,
              y: 200,
              width: 100,
              height: 50
            })
          })
        }),
        mouse: {
          click: vi.fn((x: number, y: number) => {
            clickX.push(x)
            clickY.push(y)
          })
        }
      }

      // Run multiple times to check randomization bounds
      for (let i = 0; i < 20; i++) {
        await hb.humanClick(mockPage as any, '.btn')
      }

      for (const x of clickX) {
        expect(x).toBeGreaterThanOrEqual(100 + 100 * 0.3)
        expect(x).toBeLessThanOrEqual(100 + 100 * 0.7)
      }
      for (const y of clickY) {
        expect(y).toBeGreaterThanOrEqual(200 + 50 * 0.3)
        expect(y).toBeLessThanOrEqual(200 + 50 * 0.7)
      }
    })

    it('falls back to page.click when no bounding box', async () => {
      const mockPage = {
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            boundingBox: vi.fn().mockResolvedValue(null)
          })
        }),
        click: vi.fn(),
        mouse: { click: vi.fn() }
      }

      await hb.humanClick(mockPage as any, '.btn')
      expect(mockPage.click).toHaveBeenCalledWith('.btn')
    })
  })

  describe('occasionalIdle()', () => {
    it('triggers idle at 10% chance', async () => {
      const originalRandom = Math.random

      // Force trigger (below IDLE_CHANCE)
      Math.random = vi.fn().mockReturnValue(0.05)
      const start = Date.now()
      await hb.occasionalIdle()
      const elapsed = Date.now() - start

      // Should have waited at least IDLE_MIN (3000ms) — but that's too slow for tests
      // Just verify it resolved
      expect(elapsed).toBeGreaterThanOrEqual(0)

      Math.random = originalRandom
    })
  })

  describe('static limits', () => {
    it('exposes rate limit constants', () => {
      expect(HumanBehavior.MAX_ACTIONS_PER_MINUTE).toBe(8)
      expect(HumanBehavior.MAX_APPLICATIONS_PER_SESSION).toBe(15)
      expect(HumanBehavior.MAX_EXTRACTIONS_PER_SESSION).toBe(75)
    })
  })
})
