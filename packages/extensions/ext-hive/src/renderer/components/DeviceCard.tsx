// ============================================================================
// ext-hive — DeviceCard component
// ============================================================================

import type { Device } from '../../main/types'

interface Props {
  device: Device
  onClick: () => void
}

export default function DeviceCard({ device, onClick }: Props): React.JSX.Element {
  const hw = device.hardwareInfo as Record<string, unknown> | null
  const cpu = hw?.cpu as Record<string, unknown> | undefined
  const mem = hw?.memory as Record<string, unknown> | undefined

  const arch = (hw?.arch as string) ?? ''
  const cores = cpu?.cores as number | undefined
  const ramMb = mem?.totalMb as number | undefined

  const hwSummary = [
    arch,
    cores ? `${cores} cores` : '',
    ramMb ? `${Math.round(ramMb / 1024)}GB` : ''
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2 text-left hover:bg-[var(--cos-bg-hover)] cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${device.status === 'online' ? 'bg-green-400' : 'bg-gray-500'}`}
        />
        <span className="text-xs font-medium text-[var(--cos-text-primary)] truncate">
          {device.name}
        </span>
        <span className="text-[10px] text-[var(--cos-text-muted)] ml-auto">{device.type}</span>
      </div>
      <div className="ml-4 text-[10px] text-[var(--cos-text-muted)]">
        {hwSummary && <span>{hwSummary}</span>}
        {device.lastSeenAt && (
          <span className="ml-2">
            {device.status === 'online' ? 'connected' : `last seen ${timeAgo(device.lastSeenAt)}`}
          </span>
        )}
      </div>
    </button>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
