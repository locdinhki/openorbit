interface StatusIndicatorProps {
  status: 'idle' | 'running' | 'paused' | 'error' | 'connected' | 'disconnected'
  label?: string
  className?: string
}

const statusColors: Record<string, string> = {
  idle: 'bg-gray-400',
  running: 'bg-green-400 animate-pulse',
  paused: 'bg-amber-400',
  error: 'bg-red-400',
  connected: 'bg-green-400',
  disconnected: 'bg-gray-500'
}

export default function StatusIndicator({
  status,
  label,
  className = ''
}: StatusIndicatorProps): React.JSX.Element {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      {label && <span className="text-xs text-[var(--cos-text-secondary)]">{label}</span>}
    </div>
  )
}
