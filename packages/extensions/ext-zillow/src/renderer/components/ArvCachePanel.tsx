import { useEffect } from 'react'
import { useExtZillowStore } from '../store/index'
import Button from '@renderer/components/shared/Button'

export default function ArvCachePanel(): React.JSX.Element {
  const cacheItems = useExtZillowStore((s) => s.cacheItems)
  const cacheLoading = useExtZillowStore((s) => s.cacheLoading)
  const loadCache = useExtZillowStore((s) => s.loadCache)
  const deleteCache = useExtZillowStore((s) => s.deleteCache)
  const purgeCache = useExtZillowStore((s) => s.purgeCache)

  useEffect(() => {
    loadCache()
  }, [loadCache])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">
          ARV Cache ({cacheItems.length})
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => loadCache()}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => purgeCache()}
            disabled={cacheItems.length === 0}
          >
            Purge All
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {cacheLoading ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--cos-text-muted)]">
            Loading...
          </div>
        ) : cacheItems.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--cos-text-muted)]">
            No cached lookups
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--cos-border)] text-[var(--cos-text-muted)]">
                <th className="text-left px-3 py-1.5 font-medium">Address</th>
                <th className="text-left px-3 py-1.5 font-medium">City</th>
                <th className="text-left px-3 py-1.5 font-medium">State</th>
                <th className="text-right px-3 py-1.5 font-medium">Zestimate</th>
                <th className="text-right px-3 py-1.5 font-medium">Scraped</th>
                <th className="text-right px-3 py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {cacheItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--cos-border)] hover:bg-[var(--cos-bg-hover)] transition-colors"
                >
                  <td className="px-3 py-1.5 text-[var(--cos-text-primary)]">{item.address1}</td>
                  <td className="px-3 py-1.5 text-[var(--cos-text-secondary)]">{item.city}</td>
                  <td className="px-3 py-1.5 text-[var(--cos-text-secondary)]">{item.state}</td>
                  <td className="px-3 py-1.5 text-right">
                    {item.zestimate ? (
                      <span className="text-green-400 font-medium">
                        ${item.zestimate.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[var(--cos-text-muted)]">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[var(--cos-text-muted)]">
                    {new Date(item.scraped_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => deleteCache(item.id)}
                      className="text-[var(--cos-text-muted)] hover:text-red-400 cursor-pointer transition-colors"
                      title="Delete"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
