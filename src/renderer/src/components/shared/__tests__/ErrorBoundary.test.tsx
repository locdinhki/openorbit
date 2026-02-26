import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

// Suppress console.error output from React during error boundary tests
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})
afterEach(() => {
  cleanup()
  console.error = originalConsoleError
})

// Use module-level flag so we can change it before Retry re-renders children
let shouldThrow = false

function ThrowingChild(): React.JSX.Element {
  if (shouldThrow) throw new Error('Test crash')
  return <div>Child content</div>
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    shouldThrow = false
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary section="test">
        <div>Hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello')).toBeDefined()
  })

  it('shows fallback on error with section name and error message', () => {
    shouldThrow = true
    render(
      <ErrorBoundary section="sidebar">
        <ThrowingChild />
      </ErrorBoundary>
    )

    expect(screen.getByText('sidebar encountered an error')).toBeDefined()
    expect(screen.getByText('Test crash')).toBeDefined()
    expect(screen.getByText('Retry')).toBeDefined()
  })

  it('recovers after clicking Retry when error is resolved', () => {
    shouldThrow = true
    render(
      <ErrorBoundary section="panel">
        <ThrowingChild />
      </ErrorBoundary>
    )

    expect(screen.getByText('panel encountered an error')).toBeDefined()

    // Fix the error condition before retrying
    shouldThrow = false
    fireEvent.click(screen.getByText('Retry'))

    expect(screen.getByText('Child content')).toBeDefined()
  })
})
