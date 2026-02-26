import { describe, it, expect } from 'vitest'
import {
  OpenOrbitError,
  DatabaseError,
  AIServiceError,
  AutomationError,
  PlatformError,
  AuthenticationError,
  errorToResponse
} from '../errors'

describe('OpenOrbitError', () => {
  it('stores code, context, and recoverable flag', () => {
    const err = new OpenOrbitError('something broke', 'TEST_ERROR', { key: 'val' }, true)
    expect(err.message).toBe('something broke')
    expect(err.code).toBe('TEST_ERROR')
    expect(err.context).toEqual({ key: 'val' })
    expect(err.recoverable).toBe(true)
    expect(err.name).toBe('OpenOrbitError')
  })

  it('defaults to empty context and non-recoverable', () => {
    const err = new OpenOrbitError('fail', 'FAIL')
    expect(err.context).toEqual({})
    expect(err.recoverable).toBe(false)
  })

  it('is instanceof Error', () => {
    const err = new OpenOrbitError('test', 'TEST')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpenOrbitError)
  })
})

describe('DatabaseError', () => {
  it('has DB_ERROR code and is not recoverable', () => {
    const err = new DatabaseError('constraint failed', { table: 'jobs' })
    expect(err.code).toBe('DB_ERROR')
    expect(err.recoverable).toBe(false)
    expect(err.context).toEqual({ table: 'jobs' })
    expect(err.name).toBe('DatabaseError')
    expect(err).toBeInstanceOf(OpenOrbitError)
  })
})

describe('AIServiceError', () => {
  it('accepts custom code and is recoverable', () => {
    const err = new AIServiceError('rate limited', 'RATE_LIMITED', { retryAfter: 60 })
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.recoverable).toBe(true)
    expect(err.context).toEqual({ retryAfter: 60 })
    expect(err.name).toBe('AIServiceError')
  })
})

describe('AutomationError', () => {
  it('stores code and context', () => {
    const err = new AutomationError('element not found', 'ELEMENT_NOT_FOUND', { selector: '.btn' })
    expect(err.code).toBe('ELEMENT_NOT_FOUND')
    expect(err.context).toEqual({ selector: '.btn' })
    expect(err.recoverable).toBe(false)
    expect(err.name).toBe('AutomationError')
  })
})

describe('PlatformError', () => {
  it('includes platform in context', () => {
    const err = new PlatformError('login required', 'linkedin', { url: 'https://example.com' })
    expect(err.code).toBe('PLATFORM_ERROR')
    expect(err.context).toEqual({ platform: 'linkedin', url: 'https://example.com' })
    expect(err.name).toBe('PlatformError')
  })
})

describe('AuthenticationError', () => {
  it('has AUTH_REQUIRED code and is recoverable', () => {
    const err = new AuthenticationError('Not logged in', 'linkedin')
    expect(err.code).toBe('AUTH_REQUIRED')
    expect(err.recoverable).toBe(true)
    expect(err.context).toEqual({ platform: 'linkedin' })
    expect(err.name).toBe('AuthenticationError')
  })

  it('handles no platform', () => {
    const err = new AuthenticationError('API key missing')
    expect(err.context).toEqual({})
  })
})

describe('errorToResponse()', () => {
  it('serializes OpenOrbitError to structured response', () => {
    const err = new AIServiceError('timeout', 'AI_TIMEOUT', { model: 'sonnet' })
    const response = errorToResponse(err)
    expect(response).toEqual({
      success: false,
      error: 'timeout',
      code: 'AI_TIMEOUT',
      context: { model: 'sonnet' }
    })
  })

  it('omits empty context', () => {
    const err = new DatabaseError('failed')
    const response = errorToResponse(err)
    expect(response.context).toBeUndefined()
  })

  it('handles plain Error as UNKNOWN_ERROR', () => {
    const response = errorToResponse(new Error('generic'))
    expect(response).toEqual({
      success: false,
      error: 'Error: generic',
      code: 'UNKNOWN_ERROR'
    })
  })

  it('handles string errors', () => {
    const response = errorToResponse('oops')
    expect(response).toEqual({
      success: false,
      error: 'oops',
      code: 'UNKNOWN_ERROR'
    })
  })
})
