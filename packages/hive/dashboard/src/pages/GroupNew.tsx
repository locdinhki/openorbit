import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Device } from '../lib/api'

export default function GroupNew() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listDevices()
      .then(setDevices)
      .catch(() => {})
  }, [])

  // Unique location tags from devices
  const locationTags = [...new Set(devices.map((d) => d.locationTag).filter(Boolean) as string[])]

  const matchingDevices = tagFilter ? devices.filter((d) => d.locationTag === tagFilter) : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name required')
      return
    }
    if (!tagFilter.trim()) {
      setError('Tag filter required')
      return
    }

    setSaving(true)
    try {
      await api.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        tagFilter: tagFilter.trim()
      })
      navigate('/groups')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md space-y-5">
      <h1 className="text-lg font-semibold">New Device Group</h1>

      <p className="text-xs text-gray-500">
        Groups target devices by their location tag. All devices with a matching tag belong to the
        group.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Group Name</label>
          <input
            className="input w-full"
            placeholder="e.g. Raspberry Pis"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
          <input
            className="input w-full"
            placeholder="What's in this group?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Tag Filter</label>
          <input
            className="input w-full font-mono"
            placeholder="e.g. rack-a"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            list="tag-suggestions"
          />
          {locationTags.length > 0 && (
            <datalist id="tag-suggestions">
              {locationTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          )}
          {tagFilter && (
            <p className="text-xs text-gray-500 mt-1">
              Matches {matchingDevices.length} device{matchingDevices.length !== 1 ? 's' : ''}
              {matchingDevices.length > 0 && (
                <span className="text-gray-400">
                  : {matchingDevices.map((d) => d.name).join(', ')}
                </span>
              )}
            </p>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Group'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/groups')}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
