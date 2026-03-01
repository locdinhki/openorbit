import { useState, useCallback } from 'react'
import { ipc } from '../lib/ipc-client'
import { useExtPlaidStore } from '../store/index'
import Button from '@renderer/components/shared/Button'

export default function PlaidLinkButton(): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { loadItems, loadAccounts } = useExtPlaidStore()

  const handleLink = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Create link token
      const tokenResult = await ipc.link.createToken()
      if (!tokenResult.success || !tokenResult.data) {
        setError(tokenResult.error || 'Failed to create link token')
        setLoading(false)
        return
      }

      const linkToken = tokenResult.data.linkToken

      // Open Plaid Link in a new window
      // In a real implementation, you'd use the Plaid Link SDK
      // For now, we'll simulate with a simple flow
      const linkUrl = `https://cdn.plaid.com/link/v2/stable/link.html?token=${linkToken}`

      // Open in a popup window
      const popup = window.open(linkUrl, 'PlaidLink', 'width=500,height=700,left=200,top=100')

      if (!popup) {
        setError('Failed to open Plaid Link. Please allow popups.')
        setLoading(false)
        return
      }

      // Listen for the public token from the popup
      const handleMessage = async (event: MessageEvent): Promise<void> => {
        // Verify origin if needed
        if (event.data?.type === 'plaid-link-success' && event.data?.publicToken) {
          const exchangeResult = await ipc.link.exchange(event.data.publicToken)
          if (exchangeResult.success) {
            await loadItems()
            await loadAccounts()
          } else {
            setError(exchangeResult.error || 'Failed to link account')
          }
          setLoading(false)
          window.removeEventListener('message', handleMessage)
        } else if (event.data?.type === 'plaid-link-exit') {
          setLoading(false)
          window.removeEventListener('message', handleMessage)
        }
      }

      window.addEventListener('message', handleMessage)

      // Also watch for popup close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          setLoading(false)
          window.removeEventListener('message', handleMessage)
        }
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setLoading(false)
    }
  }, [loadItems, loadAccounts])

  return (
    <div>
      <Button
        size="sm"
        variant="primary"
        onClick={handleLink}
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Connecting...' : '+ Connect Bank Account'}
      </Button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      <p className="text-xs text-[var(--cos-text-muted)] mt-1 text-center">
        Securely connect via Plaid
      </p>
    </div>
  )
}
