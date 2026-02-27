// ============================================================================
// OpenOrbit — AI Providers Panel (shell-level settings view)
//
// Lists registered AI providers, shows configuration status, and allows
// setting the default provider.
// ============================================================================

import { useAIProviders } from '../../../lib/use-ai'

const PROVIDER_ICONS: Record<string, string> = {
  claude: 'M',
  openai: 'O',
  ollama: 'L'
}

export default function AIProvidersPanel(): React.JSX.Element {
  const { providers, loading, error, setDefault } = useAIProviders()

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[var(--cos-border)]">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
          AI Providers
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--cos-text-muted)]">Loading providers...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--cos-text-muted)]">No AI providers registered</p>
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              Install an AI provider extension to enable AI features.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="p-3 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[var(--cos-bg-secondary)] flex items-center justify-center text-sm font-bold text-[var(--cos-text-secondary)]">
                    {PROVIDER_ICONS[provider.id] ?? provider.id[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--cos-text-primary)] truncate">
                      {provider.displayName}
                    </p>
                    <p className="text-xs text-[var(--cos-text-muted)]">
                      {provider.capabilities.models.length} model
                      {provider.capabilities.models.length !== 1 ? 's' : ''}
                      {provider.capabilities.streaming && ' \u00b7 Streaming'}
                      {provider.capabilities.toolCalling && ' \u00b7 Tools'}
                      {provider.capabilities.vision && ' \u00b7 Vision'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.configured ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                        Ready
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                        Not configured
                      </span>
                    )}
                    {provider.isDefault ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        Default
                      </span>
                    ) : (
                      provider.configured && (
                        <button
                          onClick={() => setDefault(provider.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--cos-bg-secondary)] text-[var(--cos-text-muted)] border border-[var(--cos-border)] hover:text-[var(--cos-text-primary)] hover:border-[var(--cos-accent)] transition-colors"
                        >
                          Set default
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Model list */}
                {provider.capabilities.models.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {provider.capabilities.models.map((model) => (
                      <span
                        key={model}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--cos-bg-secondary)] text-[var(--cos-text-muted)]"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
