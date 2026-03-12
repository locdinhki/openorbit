import { useState, useEffect } from 'react'
import { api, getUser } from '../lib/api'
import type { UserAccount } from '../lib/api'

export default function Users() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'operator' })
  const [error, setError] = useState('')
  const currentUser = getUser()

  async function load() {
    try {
      const list = await api.listUsers()
      setUsers(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.username || !form.password) {
      setError('Username and password required')
      return
    }
    try {
      await api.createUser(form)
      setForm({ username: '', password: '', role: 'operator' })
      setShowCreate(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return
    try {
      await api.deleteUser(id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  async function handleRoleChange(id: string, role: string) {
    try {
      await api.updateUser(id, { role })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-900/50 text-red-300',
      operator: 'bg-blue-900/50 text-blue-300',
      viewer: 'bg-gray-800 text-gray-400'
    }
    return (
      <span
        className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${colors[role] ?? colors.viewer}`}
      >
        {role}
      </span>
    )
  }

  if (loading) return <p className="text-xs text-gray-500">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-semibold text-white">Users</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-xs bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
        >
          {showCreate ? 'Cancel' : 'New User'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-4 p-3 bg-gray-900 border border-gray-800 rounded-md space-y-3"
        >
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="Username"
            className="w-full px-3 py-1.5 bg-black border border-gray-800 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password"
            className="w-full px-3 py-1.5 bg-black border border-gray-800 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-3 py-1.5 bg-black border border-gray-800 rounded text-xs text-white focus:outline-none focus:border-gray-600"
          >
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs bg-white text-black rounded hover:bg-gray-200 transition-colors"
          >
            Create User
          </button>
        </form>
      )}

      <div className="border border-gray-800 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left px-3 py-2 font-medium">Username</th>
              <th className="text-left px-3 py-2 font-medium">Role</th>
              <th className="text-left px-3 py-2 font-medium">Created</th>
              <th className="text-left px-3 py-2 font-medium">Last Login</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="px-3 py-2 text-white">{u.username}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === currentUser?.id}
                    className="bg-transparent text-xs text-gray-300 focus:outline-none disabled:opacity-50"
                  >
                    <option value="admin">admin</option>
                    <option value="operator">operator</option>
                    <option value="viewer">viewer</option>
                  </select>{' '}
                  {roleBadge(u.role)}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                </td>
                <td className="px-3 py-2 text-right">
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-600">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
