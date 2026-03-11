import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken, api } from '../lib/api'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError('')

    const valid = await api.validateToken(password.trim())
    if (valid) {
      setToken(password.trim())
      navigate('/')
    } else {
      setError('Invalid API key')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-white">Open Hive</h1>
          <p className="text-xs text-gray-500 mt-1">Enter your controller API key</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="API key"
          autoFocus
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full px-3 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
