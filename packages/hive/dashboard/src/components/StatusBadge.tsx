const colors: Record<string, string> = {
  online: 'bg-emerald-500/20 text-emerald-400',
  offline: 'bg-gray-700/50 text-gray-400',
  busy: 'bg-amber-500/20 text-amber-400',
  queued: 'bg-gray-700/50 text-gray-400',
  dispatched: 'bg-blue-500/20 text-blue-400',
  running: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
  timeout: 'bg-orange-500/20 text-orange-400',
  success: 'bg-emerald-500/20 text-emerald-400',
  error: 'bg-red-500/20 text-red-400'
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${colors[status] ?? 'bg-gray-700/50 text-gray-400'}`}
    >
      {status}
    </span>
  )
}
