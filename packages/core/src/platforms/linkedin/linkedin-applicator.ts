import type { Page } from 'patchright'
import type { JobListing, ApplicationResult } from '../../types'
import { HumanBehavior } from '../../automation/human-behavior'
import { PageReader } from '../../automation/page-reader'
import { AnswersRepo } from '../../db/answers-repo'
import { AnswerGenerator } from '../../ai/answer-generator'
import { createLogger } from '../../utils/logger'

const log = createLogger('LinkedInApplicator')

// --- Selectors ---

const EASY_APPLY_BUTTON = [
  'button.jobs-apply-button',
  'button[aria-label*="Easy Apply"]',
  '.jobs-apply-button--top-card button',
  'button.jobs-s-apply'
]

const MODAL_CONTAINER = [
  '.jobs-easy-apply-modal',
  '[data-test-modal-id="easy-apply-modal"]',
  '.artdeco-modal--layer-default'
]

const NEXT_BUTTON = [
  'button[aria-label="Continue to next step"]',
  'button[data-easy-apply-next-button]',
  '.artdeco-modal footer button.artdeco-button--primary'
]

const REVIEW_BUTTON = [
  'button[aria-label="Review your application"]',
  'button[data-easy-apply-review-button]'
]

const SUBMIT_BUTTON = [
  'button[aria-label="Submit application"]',
  'button[data-easy-apply-submit-button]'
]

const DISMISS_BUTTON = [
  'button[aria-label="Dismiss"]',
  '.artdeco-modal__dismiss',
  'button.artdeco-modal__dismiss'
]

const DISCARD_BUTTON = [
  'button[data-test-dialog-primary-btn]',
  'button[data-control-name="discard_application_confirm_btn"]'
]

// --- Types ---

export interface FormField {
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file'
  label: string
  selector: string
  required: boolean
  options?: string[]
  currentValue?: string
}

type StepResult = 'next' | 'review' | 'submit' | 'error'

export interface ApplicationProgress {
  step: number
  totalSteps?: number
  currentAction: string
}

export type ProgressCallback = (progress: ApplicationProgress) => void
export type QuestionCallback = (question: string, jobId: string) => Promise<string | null>

// --- Applicator ---

export class LinkedInApplicator {
  private behavior = new HumanBehavior()
  private pageReader = new PageReader()
  private answersRepo = new AnswersRepo()
  private answerGenerator = new AnswerGenerator()

  async apply(
    page: Page,
    job: JobListing,
    answers: Record<string, string>,
    resumePath: string,
    onProgress?: ProgressCallback,
    onQuestion?: QuestionCallback
  ): Promise<ApplicationResult> {
    const answersUsed: Record<string, string> = {}
    let step = 0

    try {
      // 1. Open the Easy Apply modal
      onProgress?.({ step: 0, currentAction: 'Opening Easy Apply modal' })
      const opened = await this.openEasyApplyModal(page)
      if (!opened) {
        return {
          success: false,
          jobId: job.id,
          answersUsed,
          errorMessage: 'Could not find Easy Apply button'
        }
      }

      await this.behavior.delay(1000, 2000)

      // 2. Process form steps until submit
      const maxSteps = 10
      while (step < maxSteps) {
        step++
        onProgress?.({ step, currentAction: `Processing step ${step}` })

        // Check if we're on the submit step
        if (await this.isSubmitStep(page)) {
          onProgress?.({ step, currentAction: 'Submitting application' })
          await this.clickSubmit(page)
          await this.behavior.delay(2000, 3000)

          const success = await this.checkSubmissionSuccess(page)
          if (success) {
            log.info(`Successfully applied to ${job.title} @ ${job.company}`)
            return {
              success: true,
              jobId: job.id,
              answersUsed,
              resumeUsed: resumePath
            }
          } else {
            return {
              success: false,
              jobId: job.id,
              answersUsed,
              errorMessage: 'Submission may have failed — no confirmation detected'
            }
          }
        }

        // Extract form fields on current step
        const fields = await this.extractFormFields(page)
        log.info(`Step ${step}: found ${fields.length} fields`)

        // Fill each field
        for (const field of fields) {
          const filled = await this.fillField(page, field, job, answers, answersUsed, onQuestion)
          if (!filled) {
            log.warn(`Could not fill field: ${field.label}`)
            if (field.required) {
              return {
                success: false,
                jobId: job.id,
                answersUsed,
                errorMessage: `Required field unanswered: ${field.label}`,
                needsManualIntervention: true,
                interventionReason: `Cannot answer: "${field.label}"`
              }
            }
          }
        }

        // Handle resume upload if there's a file input on this step
        const fileFields = fields.filter((f) => f.type === 'file')
        if (fileFields.length > 0 && resumePath) {
          await this.uploadResume(page, resumePath)
        }

        await this.behavior.delay(500, 1000)

        // Advance to next step
        const result = await this.advanceStep(page)
        if (result === 'error') {
          const errorText = await this.getValidationError(page)
          return {
            success: false,
            jobId: job.id,
            answersUsed,
            errorMessage: errorText || 'Failed to advance to next step'
          }
        }

        await this.behavior.delay(1000, 2000)
      }

      // Exceeded max steps
      await this.closeModal(page)
      return {
        success: false,
        jobId: job.id,
        answersUsed,
        errorMessage: `Exceeded maximum steps (${maxSteps})`
      }
    } catch (err) {
      log.error('Application failed', err)
      await this.closeModal(page).catch(() => {})
      return {
        success: false,
        jobId: job.id,
        answersUsed,
        errorMessage: String(err)
      }
    }
  }

  /** Click the Easy Apply button to open the modal */
  private async openEasyApplyModal(page: Page): Promise<boolean> {
    const selector = await this.pageReader.waitForAnySelector(page, EASY_APPLY_BUTTON, 5000)
    if (!selector) {
      log.warn('Easy Apply button not found')
      return false
    }

    await this.behavior.humanClick(page, selector)
    await this.behavior.delay(1000, 2000)

    // Wait for modal to appear
    const modal = await this.pageReader.waitForAnySelector(page, MODAL_CONTAINER, 5000)
    return modal !== null
  }

  /** Extract all form fields from the current modal step */
  async extractFormFields(page: Page): Promise<FormField[]> {
    const fields: FormField[] = []
    const modalSel = '.jobs-easy-apply-modal, .artdeco-modal'

    // Text inputs
    const textInputs = await page.$$(
      `${modalSel} input[type="text"], ${modalSel} input:not([type])`
    )
    for (const input of textInputs) {
      const field = await this.extractInputField(page, input, 'text')
      if (field) fields.push(field)
    }

    // Textareas
    const textareas = await page.$$(`${modalSel} textarea`)
    for (const textarea of textareas) {
      const field = await this.extractInputField(page, textarea, 'textarea')
      if (field) fields.push(field)
    }

    // Select dropdowns
    const selects = await page.$$(`${modalSel} select`)
    for (const select of selects) {
      const field = await this.extractSelectField(page, select)
      if (field) fields.push(field)
    }

    // Radio button groups
    const radioGroups = await page.$$(`${modalSel} fieldset`)
    for (const group of radioGroups) {
      const field = await this.extractRadioGroup(page, group)
      if (field) fields.push(field)
    }

    // File inputs (resume upload)
    const fileInputs = await page.$$(`${modalSel} input[type="file"]`)
    if (fileInputs.length > 0) {
      fields.push({
        type: 'file',
        label: 'Resume',
        selector: 'input[type="file"]',
        required: true
      })
    }

    return fields
  }

  /** Extract info from a text/textarea input */
  private async extractInputField(
    page: Page,
    element: Awaited<ReturnType<Page['$']>>,
    type: 'text' | 'textarea'
  ): Promise<FormField | null> {
    if (!element) return null

    try {
      const id = await element.getAttribute('id')
      const name = await element.getAttribute('name')
      const required =
        (await element.getAttribute('required')) !== null ||
        (await element.getAttribute('aria-required')) === 'true'
      const currentValue = await element.inputValue().catch(() => '')

      // Find label
      let label = ''
      if (id) {
        label =
          (await page.evaluate((labelFor) => {
            const lbl = document.querySelector(`label[for="${labelFor}"]`)
            return lbl?.textContent?.trim() || ''
          }, id)) || ''
      }
      if (!label) {
        label =
          (await element.getAttribute('aria-label')) ||
          (await element.getAttribute('placeholder')) ||
          name ||
          ''
      }

      if (!label) return null

      const selector = id ? `#${id}` : name ? `[name="${name}"]` : ''
      if (!selector) return null

      return { type, label, selector, required, currentValue }
    } catch {
      return null
    }
  }

  /** Extract info from a select dropdown */
  private async extractSelectField(
    page: Page,
    element: Awaited<ReturnType<Page['$']>>
  ): Promise<FormField | null> {
    if (!element) return null

    try {
      const id = await element.getAttribute('id')
      const required =
        (await element.getAttribute('required')) !== null ||
        (await element.getAttribute('aria-required')) === 'true'

      let label = ''
      if (id) {
        label =
          (await page.evaluate((labelFor) => {
            const lbl = document.querySelector(`label[for="${labelFor}"]`)
            return lbl?.textContent?.trim() || ''
          }, id)) || ''
      }
      if (!label) {
        label = (await element.getAttribute('aria-label')) || ''
      }
      if (!label) return null

      const options = await page.evaluate((selectId) => {
        const sel = selectId ? (document.querySelector(`#${selectId}`) as HTMLSelectElement) : null
        if (!sel) return []
        return Array.from(sel.options)
          .filter((o) => o.value && o.value !== '')
          .map((o) => o.textContent?.trim() || o.value)
      }, id)

      const currentValue = await element.inputValue().catch(() => '')

      return {
        type: 'select',
        label,
        selector: id ? `#${id}` : '',
        required,
        options,
        currentValue
      }
    } catch {
      return null
    }
  }

  /** Extract info from a radio button group */
  private async extractRadioGroup(
    page: Page,
    element: Awaited<ReturnType<Page['$']>>
  ): Promise<FormField | null> {
    if (!element) return null

    try {
      const legend = await element.$('legend')
      const label = legend ? await legend.innerText().catch(() => '') : ''
      if (!label) return null

      const radios = await element.$$('input[type="radio"]')
      const options: string[] = []
      let firstRadioName = ''

      for (const radio of radios) {
        const name = await radio.getAttribute('name')
        if (!firstRadioName && name) firstRadioName = name
        const radioLabel = await page.evaluate((el) => {
          const parent = el.closest('label')
          return parent?.textContent?.trim() || ''
        }, radio)
        if (radioLabel) options.push(radioLabel)
      }

      return {
        type: 'radio',
        label,
        selector: firstRadioName ? `input[name="${firstRadioName}"]` : '',
        required: true,
        options
      }
    } catch {
      return null
    }
  }

  /** Fill a single form field with an appropriate answer */
  private async fillField(
    page: Page,
    field: FormField,
    job: JobListing,
    providedAnswers: Record<string, string>,
    answersUsed: Record<string, string>,
    onQuestion?: QuestionCallback
  ): Promise<boolean> {
    // Skip file fields — handled separately
    if (field.type === 'file') return true

    // Skip if already filled
    if (field.currentValue && field.type !== 'select') return true

    // 1. Check provided answers (from profile or user)
    const normalizedLabel = field.label.toLowerCase().trim()
    let answer = this.findProvidedAnswer(normalizedLabel, providedAnswers)

    // 2. Check saved answer templates
    if (!answer) {
      const template = this.answersRepo.findMatch(field.label)
      if (template) {
        answer = template.answer
        this.answersRepo.recordUsage(template.id)
      }
    }

    // 3. Use AI to generate answer
    if (!answer && field.required) {
      try {
        const generated = await this.answerGenerator.generateAnswer(field.label, job)
        if (generated.confidence >= 0.6 && !generated.needsReview) {
          answer = generated.answer
        } else if (onQuestion) {
          const userAnswer = await onQuestion(field.label, job.id)
          if (userAnswer) {
            answer = userAnswer
            this.answersRepo.insert({
              questionPattern: field.label,
              answer: userAnswer,
              platform: 'linkedin'
            })
          }
        }
      } catch (err) {
        log.warn(`AI answer generation failed for: ${field.label}`, err)
      }
    }

    // 4. Ask user as last resort
    if (!answer && field.required && onQuestion) {
      const userAnswer = await onQuestion(field.label, job.id)
      if (userAnswer) {
        answer = userAnswer
        this.answersRepo.insert({
          questionPattern: field.label,
          answer: userAnswer,
          platform: 'linkedin'
        })
      }
    }

    if (!answer) return !field.required

    answersUsed[field.label] = answer

    switch (field.type) {
      case 'text':
      case 'textarea':
        await this.fillTextInput(page, field.selector, answer)
        break
      case 'select':
        await this.fillSelect(page, field.selector, answer, field.options)
        break
      case 'radio':
        await this.fillRadio(page, field.selector, answer, field.options)
        break
      case 'checkbox':
        if (['yes', 'true', '1'].includes(answer.toLowerCase())) {
          await page.check(field.selector).catch(() => {})
        }
        break
      default:
        break
    }

    return true
  }

  /** Search provided answers map with fuzzy matching */
  private findProvidedAnswer(label: string, answers: Record<string, string>): string | undefined {
    // Exact match
    if (answers[label]) return answers[label]

    // Fuzzy match
    for (const [key, value] of Object.entries(answers)) {
      const normalizedKey = key.toLowerCase().trim()
      if (label.includes(normalizedKey) || normalizedKey.includes(label)) {
        return value
      }
    }

    return undefined
  }

  /** Type text into a text input with human-like behavior */
  private async fillTextInput(page: Page, selector: string, value: string): Promise<void> {
    try {
      await page.click(selector, { clickCount: 3 })
      await this.behavior.delay(100, 300)
      await page.keyboard.press('Backspace')
      await this.behavior.delay(200, 400)
      await this.behavior.humanType(page, selector, value)
    } catch (err) {
      log.warn(`Failed to fill text input: ${selector}`, err)
      await page.fill(selector, value).catch(() => {})
    }
  }

  /** Select a value from a dropdown */
  private async fillSelect(
    page: Page,
    selector: string,
    answer: string,
    options?: string[]
  ): Promise<void> {
    try {
      const bestOption = this.findBestOption(answer, options || [])
      if (bestOption) {
        await page.selectOption(selector, { label: bestOption })
      } else {
        await page.selectOption(selector, answer).catch(() => {})
      }
    } catch (err) {
      log.warn(`Failed to fill select: ${selector}`, err)
    }
  }

  /** Select a radio button */
  private async fillRadio(
    page: Page,
    selector: string,
    answer: string,
    options?: string[]
  ): Promise<void> {
    try {
      const bestOption = this.findBestOption(answer, options || [])
      if (!bestOption) return

      const radios = await page.$$(selector)
      for (const radio of radios) {
        const radioLabel = await page.evaluate((el) => {
          const parent = el.closest('label')
          return parent?.textContent?.trim() || ''
        }, radio)

        if (radioLabel.toLowerCase().includes(bestOption.toLowerCase())) {
          await radio.check()
          return
        }
      }
    } catch (err) {
      log.warn(`Failed to fill radio: ${selector}`, err)
    }
  }

  /** Find the best matching option from a list */
  private findBestOption(answer: string, options: string[]): string | undefined {
    const lower = answer.toLowerCase()

    // Exact match
    const exact = options.find((o) => o.toLowerCase() === lower)
    if (exact) return exact

    // Contains match
    const contains = options.find(
      (o) => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())
    )
    if (contains) return contains

    // First word match
    const firstWord = lower.split(/\s+/)[0]
    return options.find((o) => o.toLowerCase().startsWith(firstWord))
  }

  /** Upload a resume file */
  private async uploadResume(page: Page, resumePath: string): Promise<void> {
    try {
      const fileInput = await page.$(
        '.jobs-easy-apply-modal input[type="file"], .artdeco-modal input[type="file"]'
      )
      if (fileInput) {
        await fileInput.setInputFiles(resumePath)
        log.info(`Uploaded resume: ${resumePath}`)
        await this.behavior.delay(1000, 2000)
      }
    } catch (err) {
      log.warn('Resume upload failed', err)
    }
  }

  /** Advance to the next step in the modal */
  private async advanceStep(page: Page): Promise<StepResult> {
    // Try submit button first
    const submitSel = await this.pageReader.waitForAnySelector(page, SUBMIT_BUTTON, 1000)
    if (submitSel) return 'submit'

    // Try review button
    const reviewSel = await this.pageReader.waitForAnySelector(page, REVIEW_BUTTON, 1000)
    if (reviewSel) {
      await this.behavior.humanClick(page, reviewSel)
      await this.behavior.delay(1000, 2000)
      return 'review'
    }

    // Try next button
    const nextSel = await this.pageReader.waitForAnySelector(page, NEXT_BUTTON, 2000)
    if (nextSel) {
      await this.behavior.humanClick(page, nextSel)
      await this.behavior.delay(1000, 2000)

      const error = await this.getValidationError(page)
      if (error) return 'error'

      return 'next'
    }

    return 'error'
  }

  /** Check if we're on the submit step */
  private async isSubmitStep(page: Page): Promise<boolean> {
    const submitSel = await this.pageReader.waitForAnySelector(page, SUBMIT_BUTTON, 1000)
    return submitSel !== null
  }

  /** Click the submit button */
  private async clickSubmit(page: Page): Promise<void> {
    const submitSel = await this.pageReader.waitForAnySelector(page, SUBMIT_BUTTON, 3000)
    if (submitSel) {
      await this.behavior.humanClick(page, submitSel)
    }
  }

  /** Check for successful submission */
  private async checkSubmissionSuccess(page: Page): Promise<boolean> {
    const successPhrases = [
      'application was sent',
      'applied successfully',
      'your application',
      'application submitted'
    ]

    try {
      await this.behavior.delay(1000, 2000)
      const modalText = await this.pageReader
        .getVisibleText(page, MODAL_CONTAINER[0])
        .catch(() => '')

      const hasSuccess = successPhrases.some((p) => modalText.toLowerCase().includes(p))

      if (hasSuccess) {
        const dismissSel = await this.pageReader.waitForAnySelector(page, DISMISS_BUTTON, 3000)
        if (dismissSel) {
          await this.behavior.humanClick(page, dismissSel)
        }
        return true
      }

      // Check specific elements for success text
      const successSelectors = ['.artdeco-modal h2', '.jpac-modal-header']
      for (const sel of successSelectors) {
        try {
          const text = await page.locator(sel).first().innerText({ timeout: 2000 })
          if (successPhrases.some((p) => text.toLowerCase().includes(p))) {
            return true
          }
        } catch {
          /* try next */
        }
      }
    } catch {
      // If modal is gone, likely succeeded
      const modalVisible = await this.pageReader.waitForAnySelector(page, MODAL_CONTAINER, 1000)
      return modalVisible === null
    }

    return false
  }

  /** Get validation error text from the modal */
  private async getValidationError(page: Page): Promise<string | null> {
    const errorSelectors = [
      '.artdeco-inline-feedback--error',
      '.fb-form-element__error-text',
      '[data-test-form-element-error-text]'
    ]

    for (const sel of errorSelectors) {
      try {
        const el = page.locator(sel).first()
        const visible = await el.isVisible({ timeout: 500 })
        if (visible) {
          return await el.innerText()
        }
      } catch {
        /* try next */
      }
    }

    return null
  }

  /** Close the Easy Apply modal */
  async closeModal(page: Page): Promise<void> {
    try {
      const dismissSel = await this.pageReader.waitForAnySelector(page, DISMISS_BUTTON, 2000)
      if (dismissSel) {
        await this.behavior.humanClick(page, dismissSel)
        await this.behavior.delay(500, 1000)

        const discardSel = await this.pageReader.waitForAnySelector(page, DISCARD_BUTTON, 2000)
        if (discardSel) {
          await this.behavior.humanClick(page, discardSel)
        }
      }
    } catch (err) {
      log.warn('Failed to close modal', err)
    }
  }
}
