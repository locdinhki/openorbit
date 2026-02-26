import type { Page } from 'patchright'
import {
  HUMAN_DELAY_MIN,
  HUMAN_DELAY_MAX,
  HUMAN_TYPE_MIN,
  HUMAN_TYPE_MAX,
  HUMAN_READING_PAUSE_PER_SENTENCE,
  BETWEEN_LISTINGS_MIN,
  BETWEEN_LISTINGS_MAX,
  BETWEEN_APPLICATIONS_MIN,
  BETWEEN_APPLICATIONS_MAX,
  IDLE_CHANCE,
  IDLE_MIN,
  IDLE_MAX,
  MAX_ACTIONS_PER_MINUTE,
  MAX_APPLICATIONS_PER_SESSION,
  MAX_EXTRACTIONS_PER_SESSION,
  SESSION_DURATION_MAX_MINUTES
} from '../constants'

export class HumanBehavior {
  static MAX_ACTIONS_PER_MINUTE = MAX_ACTIONS_PER_MINUTE
  static MAX_APPLICATIONS_PER_SESSION = MAX_APPLICATIONS_PER_SESSION
  static MAX_EXTRACTIONS_PER_SESSION = MAX_EXTRACTIONS_PER_SESSION
  static SESSION_DURATION_MAX_MINUTES = SESSION_DURATION_MAX_MINUTES

  async delay(min = HUMAN_DELAY_MIN, max = HUMAN_DELAY_MAX): Promise<void> {
    const ms = Math.random() * (max - min) + min
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  async humanType(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector)
    await this.delay(200, 500)

    for (const char of text) {
      await page.keyboard.type(char, {
        delay: Math.random() * (HUMAN_TYPE_MAX - HUMAN_TYPE_MIN) + HUMAN_TYPE_MIN
      })
      // Occasional micro-pause mid-word
      if (Math.random() < 0.05) {
        await this.delay(200, 600)
      }
    }
  }

  async humanScroll(page: Page, direction: 'down' | 'up', amount: number): Promise<void> {
    const steps = Math.ceil(amount / 100)
    const scrollDelta = direction === 'down' ? 100 : -100

    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, scrollDelta)
      await this.delay(50, 200)
    }
  }

  async readingPause(textLength: number): Promise<void> {
    const estimatedSentences = Math.max(1, Math.ceil(textLength / 75))
    const pause = estimatedSentences * HUMAN_READING_PAUSE_PER_SENTENCE
    const variance = pause * 0.3
    await this.delay(pause - variance, pause + variance)
  }

  async betweenListings(): Promise<void> {
    await this.delay(BETWEEN_LISTINGS_MIN, BETWEEN_LISTINGS_MAX)
  }

  async betweenApplications(): Promise<void> {
    await this.delay(BETWEEN_APPLICATIONS_MIN, BETWEEN_APPLICATIONS_MAX)
  }

  async occasionalIdle(): Promise<void> {
    if (Math.random() < IDLE_CHANCE) {
      await this.delay(IDLE_MIN, IDLE_MAX)
    }
  }

  async scrollIntoView(page: Page, selector: string): Promise<void> {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, selector)
    await this.delay(300, 800)
  }

  async humanClick(page: Page, selector: string): Promise<void> {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) {
      await page.click(selector)
      return
    }
    const x = box.x + box.width * (0.3 + Math.random() * 0.4)
    const y = box.y + box.height * (0.3 + Math.random() * 0.4)
    await page.mouse.click(x, y)
  }
}
