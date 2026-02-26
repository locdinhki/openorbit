import { useExtZillowStore } from '../store/index'
import Badge from '@renderer/components/shared/Badge'

export default function ZillowWorkspace(): React.JSX.Element {
  const selectedLookup = useExtZillowStore((s) => s.selectedLookup)

  if (!selectedLookup) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-sm">
        Enter an address to look up Zestimate
      </div>
    )
  }

  const { address1, city, state, postal_code, zestimate, zillow_url, error, scraped_at } =
    selectedLookup

  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* Address */}
      <h2 className="text-lg font-semibold text-[var(--cos-text-primary)] mb-1">{address1}</h2>
      <p className="text-sm text-[var(--cos-text-secondary)] mb-6">
        {city}, {state} {postal_code}
      </p>

      {/* Zestimate */}
      {zestimate ? (
        <div className="bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-lg p-6 mb-4">
          <div className="text-xs text-[var(--cos-text-muted)] uppercase tracking-wider mb-1">
            Zestimate (ARV)
          </div>
          <div className="text-3xl font-bold text-green-400">${zestimate.toLocaleString()}</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="success">Cached</Badge>
            <span className="text-[10px] text-[var(--cos-text-muted)]">
              Scraped {new Date(scraped_at).toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-lg p-6 mb-4">
          <div className="text-xs text-[var(--cos-text-muted)] uppercase tracking-wider mb-1">
            Zestimate
          </div>
          <div className="text-xl text-[var(--cos-text-muted)]">Not available</div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* Zillow Link */}
      {zillow_url && (
        <a
          href={zillow_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View on Zillow &rarr;
        </a>
      )}
    </div>
  )
}
