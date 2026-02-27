// ============================================================================
// OpenOrbit — Calculator Skill
//
// Safe math expression evaluator. Supports basic arithmetic, parentheses,
// and common math functions. No raw eval() — uses Function constructor
// with input sanitization.
// ============================================================================

import type { Skill, SkillResult } from '../skill-types'

export function createCalcSkill(extensionId: string): Skill {
  return {
    id: 'calc-expression',
    displayName: 'Calculator',
    description:
      'Evaluate a mathematical expression and return the numeric result. Supports basic arithmetic (+, -, *, /, %, ^), parentheses, and functions: sqrt, abs, ceil, floor, round, pi.',
    category: 'data',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: true,
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description:
            'Mathematical expression to evaluate (e.g. "2 + 3 * 4", "sqrt(16)", "(100 - 20) / 4")'
        }
      },
      required: ['expression']
    },
    outputSchema: {
      type: 'object',
      description: 'Evaluation result',
      properties: {
        result: { type: 'number', description: 'The computed result' },
        expression: { type: 'string', description: 'The original expression' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const expr = input.expression as string
      if (!expr || typeof expr !== 'string') {
        return { success: false, error: 'Missing or invalid expression' }
      }

      try {
        const result = safeMathEval(expr)
        return {
          success: true,
          data: { result, expression: expr },
          summary: `${expr} = ${result}`
        }
      } catch (err) {
        return {
          success: false,
          error: `Failed to evaluate: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Safe math evaluator — no raw eval(), validates input characters
// ---------------------------------------------------------------------------

/** Allowed characters: digits, operators, parens, dots, spaces, and function names */
const ALLOWED_PATTERN = /^[0-9+\-*/().%^ a-z]+$/i

/** Supported functions mapped to Math.* */
const MATH_FUNCTIONS = ['sqrt', 'abs', 'ceil', 'floor', 'round'] as const

/** All allowed alphabetic identifiers (functions + constants) */
const ALLOWED_IDENTIFIERS = new Set<string>([...MATH_FUNCTIONS, 'pi'])

export function safeMathEval(expr: string): number {
  const sanitized = expr.trim()

  if (!sanitized) {
    throw new Error('Empty expression')
  }

  if (!ALLOWED_PATTERN.test(sanitized)) {
    throw new Error('Invalid characters in expression')
  }

  // Ensure all alphabetic identifiers are in the allowed list
  const identifiers = sanitized.match(/[a-z]+/gi) ?? []
  for (const id of identifiers) {
    if (!ALLOWED_IDENTIFIERS.has(id.toLowerCase())) {
      throw new Error('Invalid characters in expression')
    }
  }

  // Replace supported functions and constants
  let processed = sanitized
  for (const fn of MATH_FUNCTIONS) {
    processed = processed.replace(new RegExp(`\\b${fn}\\b`, 'gi'), `Math.${fn}`)
  }
  processed = processed.replace(/\bpi\b/gi, String(Math.PI))
  processed = processed.replace(/\^/g, '**')

  // Use Function constructor (safer than eval, scoped to Math only)
  const fn = new Function('Math', `"use strict"; return (${processed})`)
  const result = fn(Math)

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Result is not a finite number')
  }

  return result
}
