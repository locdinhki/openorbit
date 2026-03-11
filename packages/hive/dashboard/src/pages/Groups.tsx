import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type DeviceGroup, type BroadcastResult } from '../lib/api'
import { relativeTime } from '../lib/time'
import StatusBadge from '../components/StatusBadge'

interface BroadcastForm {
  groupId: string
  command: string
}

export default function Groups() {
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [broadcastForm, setBroadcastForm] = useState<BroadcastForm | null>(null)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null)

  useEffect(() => {
    api
      .listGroups()
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this group?')) return
    await api.deleteGroup(id)
    setGroups(await api.listGroups())
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault()
    if (!broadcastForm?.command.trim()) return
    setBroadcasting(true)
    setBroadcastResult(null)
    try {
      const result = await api.broadcast(broadcastForm.groupId, {
        instruction: { type: 'exec', command: broadcastForm.command }
      })
      setBroadcastResult(result)
      setBroadcastForm(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Broadcast failed')
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Device Groups</h1>
        <Link
          to="/groups/new"
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          New Group
        </Link>
      </div>

      {broadcastResult && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-xs">
          <p className="text-green-400 font-medium mb-1">
            Broadcast dispatched to {broadcastResult.taskCount} device
            {broadcastResult.taskCount !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {broadcastResult.tasks.map((t) => (
              <Link
                key={t.id}
                to={`/tasks/${t.id}`}
                className="text-blue-400 hover:text-blue-300 font-mono"
              >
                {t.id.slice(0, 8)} →
              </Link>
            ))}
          </div>
          <button
            onClick={() => setBroadcastResult(null)}
            className="mt-2 text-gray-500 hover:text-gray-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">No groups configured</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>
                      Tag: <span className="font-mono text-gray-400">{group.tagFilter}</span>
                    </span>
                    <span>
                      {group.memberCount ?? 0} device{group.memberCount !== 1 ? 's' : ''},&nbsp;
                      <span className="text-green-400">{group.onlineCount ?? 0} online</span>
                    </span>
                    <span>{relativeTime(group.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setBroadcastForm(
                        broadcastForm?.groupId === group.id
                          ? null
                          : { groupId: group.id, command: '' }
                      )
                    }
                    className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-xs text-white rounded transition-colors"
                  >
                    Broadcast
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Inline broadcast form */}
              {broadcastForm?.groupId === group.id && (
                <form onSubmit={handleBroadcast} className="mt-3 flex gap-2">
                  <input
                    autoFocus
                    className="input flex-1 font-mono text-xs"
                    placeholder="Shell command to run on all online members…"
                    value={broadcastForm.command}
                    onChange={(e) =>
                      setBroadcastForm((f) => f && { ...f, command: e.target.value })
                    }
                  />
                  <button
                    type="submit"
                    disabled={broadcasting || !broadcastForm.command.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs text-white rounded transition-colors disabled:opacity-50 shrink-0"
                  >
                    {broadcasting ? 'Sending…' : 'Send'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastForm(null)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
