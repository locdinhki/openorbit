import { describe, it, expect } from 'vitest'
import { deduplicateTitle } from '../automation/extraction-runner'

describe('deduplicateTitle', () => {
  it('removes duplicated title text from LinkedIn extraction', () => {
    const input =
      'Agentic AI Developer (Python/LLM/RAG) Agentic AI Developer (Python/LLM/RAG) with verification'
    expect(deduplicateTitle(input)).toBe('Agentic AI Developer (Python/LLM/RAG) with verification')
  })

  it('removes exact duplicate', () => {
    expect(deduplicateTitle('Software Engineer Software Engineer')).toBe('Software Engineer')
  })

  it('returns original when no duplication', () => {
    expect(deduplicateTitle('Senior Frontend Developer')).toBe('Senior Frontend Developer')
  })

  it('handles short titles', () => {
    expect(deduplicateTitle('Dev')).toBe('Dev')
  })

  it('handles empty string', () => {
    expect(deduplicateTitle('')).toBe('')
  })

  it('trims whitespace', () => {
    expect(deduplicateTitle('  Frontend Dev  ')).toBe('Frontend Dev')
  })

  it('handles title with suffix on second occurrence', () => {
    const input = 'Data Scientist Data Scientist - Remote'
    expect(deduplicateTitle(input)).toBe('Data Scientist - Remote')
  })
})
