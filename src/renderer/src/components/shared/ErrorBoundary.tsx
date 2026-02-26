import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  section: string
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.section}]`, error, info.componentStack)
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="text-sm font-medium text-[var(--cos-text-secondary)] mb-2">
            {this.props.section} encountered an error
          </div>
          <div className="text-xs text-[var(--cos-text-tertiary)] mb-4 max-w-[300px] break-words">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </div>
          <button
            onClick={this.handleRetry}
            className="px-3 py-1.5 text-xs rounded bg-[var(--cos-accent)] text-white hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
