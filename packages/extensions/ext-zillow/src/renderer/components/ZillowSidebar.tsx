import { useEffect } from 'react'
import { useExtZillowStore } from '../store/index'
import Button from '@renderer/components/shared/Button'

export default function ZillowSidebar(): React.JSX.Element {
  const address = useExtZillowStore((s) => s.address)
  const setAddress = useExtZillowStore((s) => s.setAddress)
  const searching = useExtZillowStore((s) => s.searching)
  const search = useExtZillowStore((s) => s.search)
  const error = useExtZillowStore((s) => s.error)
  const cacheItems = useExtZillowStore((s) => s.cacheItems)
  const loadCache = useExtZillowStore((s) => s.loadCache)
  const setSelectedLookup = useExtZillowStore((s) => s.setSelectedLookup)

  useEffect(() => {
    loadCache()
  }, [loadCache])

  const canSearch =
    address.address1.trim() &&
    address.city.trim() &&
    address.state.trim() &&
    address.postalCode.trim()

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (canSearch && !searching) search()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">Zillow Lookup</span>
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2 space-y-2 border-b border-[var(--cos-border)]"
      >
        <input
          type="text"
          placeholder="Street address"
          value={address.address1}
          onChange={(e) => setAddress('address1', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="City"
            value={address.city}
            onChange={(e) => setAddress('city', e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="ST"
            value={address.state}
            onChange={(e) => setAddress('state', e.target.value)}
            className="w-12 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="ZIP"
            value={address.postalCode}
            onChange={(e) => setAddress('postalCode', e.target.value)}
            className="w-20 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!canSearch || searching}
            className="flex-1"
          >
            {searching ? 'Searching...' : 'Get ARV'}
          </Button>
        </div>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </form>

      {/* Recent Lookups */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-medium text-[var(--cos-text-muted)] uppercase tracking-wider">
            Recent Lookups
          </span>
        </div>
        {cacheItems.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[var(--cos-text-muted)]">No lookups yet</p>
        ) : (
          <div className="space-y-0.5">
            {cacheItems.slice(0, 20).map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedLookup(item)}
                className="w-full px-3 py-1.5 text-left hover:bg-[var(--cos-bg-hover)] cursor-pointer transition-colors"
              >
                <div className="text-xs text-[var(--cos-text-primary)] truncate">
                  {item.address1}
                </div>
                <div className="text-[10px] text-[var(--cos-text-muted)] flex justify-between">
                  <span>
                    {item.city}, {item.state} {item.postal_code}
                  </span>
                  {item.zestimate ? (
                    <span className="text-green-400 font-medium">
                      ${item.zestimate.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[var(--cos-text-muted)]">N/A</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
