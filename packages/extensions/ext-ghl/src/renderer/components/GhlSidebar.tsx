import { useState, useEffect, lazy, Suspense } from 'react'
import { useExtGhlStore } from '../store/index'
import ContactList from './contacts/ContactList'
import PipelineBoard from './pipeline/PipelineBoard'
import ConversationList from './conversations/ConversationList'
import CalendarList from './calendars/CalendarList'
import Button from '@renderer/components/shared/Button'

const LazyGhlConnectionSettings = lazy(() => import('./settings/GhlConnectionSettings'))

type Tab = 'contacts' | 'pipeline' | 'conversations' | 'calendars'

export default function GhlSidebar(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('contacts')
  const [showSettings, setShowSettings] = useState(false)
  const hasToken = useExtGhlStore((s) => s.hasToken)
  const loadSettings = useExtGhlStore((s) => s.loadSettings)
  const syncing = useExtGhlStore((s) => s.syncing)
  const syncContacts = useExtGhlStore((s) => s.syncContacts)
  const oppsSyncing = useExtGhlStore((s) => s.oppsSyncing)
  const syncOpportunities = useExtGhlStore((s) => s.syncOpportunities)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  if (showSettings) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2 border-b border-[var(--cos-border)]">
          <button
            onClick={() => setShowSettings(false)}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer text-xs mr-2"
          >
            &larr;
          </button>
          <span className="text-xs font-medium text-[var(--cos-text-primary)]">Settings</span>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
              Loading...
            </div>
          }
        >
          <LazyGhlConnectionSettings />
        </Suspense>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'contacts', label: 'Contacts' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'conversations', label: 'Convos' },
    { key: 'calendars', label: 'Calendar' }
  ]

  const handleSync = (): void => {
    if (activeTab === 'contacts') syncContacts()
    else if (activeTab === 'pipeline') syncOpportunities()
  }

  const isSyncing = activeTab === 'contacts' ? syncing : oppsSyncing
  const canSync = activeTab === 'contacts' || activeTab === 'pipeline'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">GoHighLevel</span>
        <div className="flex items-center gap-1">
          {canSync && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSync}
              disabled={isSyncing || !hasToken}
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer text-sm px-1"
            title="Settings"
          >
            &#9881;
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--cos-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium cursor-pointer transition-colors ${
              activeTab === tab.key
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasToken ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-2">
            <p className="text-xs text-[var(--cos-text-muted)] text-center">
              Configure your GHL API token to get started
            </p>
            <Button size="sm" variant="primary" onClick={() => setShowSettings(true)}>
              Configure
            </Button>
          </div>
        ) : (
          <>
            {activeTab === 'contacts' && <ContactList />}
            {activeTab === 'pipeline' && <PipelineBoard />}
            {activeTab === 'conversations' && <ConversationList />}
            {activeTab === 'calendars' && <CalendarList />}
          </>
        )}
      </div>
    </div>
  )
}
