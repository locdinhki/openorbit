import type { ActionExecutor, ActionResult } from '../types'
import type { Page } from 'patchright'
import { ActionLogRepo } from '../db/action-log-repo'
import { createLogger } from '../utils/logger'

const log = createLogger('ActionEngine')

export class ActionEngine {
  private executor: ActionExecutor
  private actionLog: ActionLogRepo

  constructor(executor: ActionExecutor) {
    this.executor = executor
    this.actionLog = new ActionLogRepo()
  }

  setExecutor(executor: ActionExecutor): void {
    this.executor = executor
  }

  async performIntent(intent: string, page: Page): Promise<ActionResult> {
    const url = page.url()
    const site = new URL(url).hostname

    const context = {
      site,
      url,
      page
    }

    const result = await this.executor.execute(intent, context)

    // Log the action
    try {
      this.actionLog.insert({
        site,
        url,
        intent,
        pageSnapshot: '',
        hintUsed: {
          intent,
          hint: {
            selectors: result.selector ? [result.selector] : [],
            textMatches: result.text ? [result.text] : [],
            ariaLabels: result.label ? [result.label] : [],
            location: '',
            elementType: ''
          },
          fallbackDescription: intent,
          lastVerified: new Date().toISOString(),
          confidence: result.success ? 1.0 : 0.0,
          failureCount: result.success ? 0 : 1
        },
        executionMethod: 'hint',
        action: {
          type: 'click',
          target: result.selector ?? intent,
          value: result.text
        },
        success: result.success,
        errorMessage: result.errorMessage
      })
    } catch (err) {
      log.error('Failed to log action', err)
    }

    return result
  }
}
