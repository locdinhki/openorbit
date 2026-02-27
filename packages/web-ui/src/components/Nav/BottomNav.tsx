export type Tab = 'chat' | 'jobs' | 'status'

interface Props {
  activeTab: Tab
  onSelect: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '\u{1F4AC}' },
  { id: 'jobs', label: 'Jobs', icon: '\u{1F4BC}' },
  { id: 'status', label: 'Status', icon: '\u{26A1}' }
]

export default function BottomNav({ activeTab, onSelect }: Props): React.JSX.Element {
  return (
    <nav
      className="flex safe-area-bottom"
      style={{
        borderTop: '1px solid var(--cos-border)',
        background: 'var(--cos-bg-secondary)'
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className="flex-1 flex flex-col items-center py-2 text-xs transition-colors cursor-pointer"
          style={{ color: activeTab === tab.id ? 'var(--cos-accent)' : 'var(--cos-text-muted)' }}
        >
          <span className="text-lg mb-0.5">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
