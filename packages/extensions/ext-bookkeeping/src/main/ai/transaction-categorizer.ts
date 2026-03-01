// ============================================================================
// AI Transaction Categorizer
// ============================================================================

import type { AIService } from '@openorbit/core/ai/provider-types'
import type { BkCategoryRow } from '../db/categories-repo'
import type { BkTransactionRow } from '../db/transactions-repo'

export interface CategorizationResult {
  categoryId: string
  confidence: number
  reasoning: string
}

const SYSTEM_PROMPT = `You are a bookkeeping assistant that categorizes financial transactions. Given a transaction description and list of available categories, determine the most appropriate category.

Respond with ONLY valid JSON in this exact format:
{
  "categoryId": "<id of best matching category>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}

Rules:
- Choose the most specific category that applies
- If uncertain, use a general category like "Other Expenses" or "Other Income"
- Confidence should reflect how certain you are (0.9+ for clear matches, 0.5-0.7 for uncertain)
- For income transactions (positive amounts or deposits), use income categories
- For expense transactions (negative amounts or withdrawals), use expense categories`

export class TransactionCategorizer {
  constructor(private ai: AIService) {}

  async categorize(
    transaction: BkTransactionRow,
    categories: BkCategoryRow[]
  ): Promise<CategorizationResult> {
    const categoryList = categories.map((c) => `- ${c.id}: ${c.name} (${c.type})`).join('\n')

    const userMessage = `Categorize this transaction:
- Description: ${transaction.description}
- Payee: ${transaction.payee || 'Unknown'}
- Amount: ${transaction.amount} (${transaction.amount < 0 ? 'expense' : 'income/deposit'})
- Date: ${transaction.date}

Available categories:
${categoryList}`

    const result = await this.ai.complete({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      tier: 'fast',
      maxTokens: 256,
      task: 'categorize_transaction'
    })

    return this.parseResult(result.content, categories)
  }

  async categorizeBatch(
    transactions: BkTransactionRow[],
    categories: BkCategoryRow[],
    onProgress?: (index: number, total: number) => void
  ): Promise<Map<string, CategorizationResult>> {
    const results = new Map<string, CategorizationResult>()

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i]
      onProgress?.(i, transactions.length)

      try {
        const result = await this.categorize(txn, categories)
        results.set(txn.id, result)
      } catch {
        // Skip failed categorizations
      }

      // Brief delay between API calls
      if (i < transactions.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    return results
  }

  private parseResult(response: string, categories: BkCategoryRow[]): CategorizationResult {
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(jsonStr)

      // Validate category exists
      const category = categories.find((c) => c.id === parsed.categoryId)
      if (!category) {
        // Fall back to most generic category of the appropriate type
        const fallback =
          categories.find((c) => c.name.toLowerCase().includes('other')) ?? categories[0]
        return {
          categoryId: fallback.id,
          confidence: 0.3,
          reasoning: 'Could not match suggested category'
        }
      }

      return {
        categoryId: String(parsed.categoryId),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || '')
      }
    } catch {
      // Fall back to generic category
      const fallback =
        categories.find((c) => c.name.toLowerCase().includes('other expense')) ?? categories[0]
      return {
        categoryId: fallback.id,
        confidence: 0.2,
        reasoning: 'Failed to parse AI response'
      }
    }
  }
}
