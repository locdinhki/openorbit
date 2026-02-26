export class OpenOrbitError extends Error {
  constructor(
    message: string,
    public code: string,
    public context: Record<string, unknown> = {},
    public recoverable: boolean = false
  ) {
    super(message)
    this.name = 'OpenOrbitError'
  }
}

export class DatabaseError extends OpenOrbitError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DB_ERROR', context, false)
    this.name = 'DatabaseError'
  }
}

export class AIServiceError extends OpenOrbitError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context, true)
    this.name = 'AIServiceError'
  }
}

export class AutomationError extends OpenOrbitError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context, false)
    this.name = 'AutomationError'
  }
}

export class PlatformError extends OpenOrbitError {
  constructor(message: string, platform: string, context?: Record<string, unknown>) {
    super(message, 'PLATFORM_ERROR', { platform, ...context }, false)
    this.name = 'PlatformError'
  }
}

export class AuthenticationError extends OpenOrbitError {
  constructor(message: string, platform?: string) {
    super(message, 'AUTH_REQUIRED', platform ? { platform } : {}, true)
    this.name = 'AuthenticationError'
  }
}

/** Serialize an OpenOrbitError to a structured IPC response */
export function errorToResponse(err: unknown): {
  success: false
  error: string
  code: string
  context?: Record<string, unknown>
} {
  if (err instanceof OpenOrbitError) {
    return {
      success: false,
      error: err.message,
      code: err.code,
      context: Object.keys(err.context).length > 0 ? err.context : undefined
    }
  }
  return {
    success: false,
    error: String(err),
    code: 'UNKNOWN_ERROR'
  }
}
