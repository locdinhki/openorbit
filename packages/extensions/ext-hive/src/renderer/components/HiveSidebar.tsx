// ============================================================================
// ext-hive — Sidebar: Device Fleet
// ============================================================================

import { useEffect } from 'react'
import { useExtHiveStore } from '../store/index'
import DeviceCard from './DeviceCard'

export default function HiveSidebar(): React.JSX.Element {
  const devices = useExtHiveStore((s) => s.devices)
  const devicesLoading = useExtHiveStore((s) => s.devicesLoading)
  const devicesError = useExtHiveStore((s) => s.devicesError)
  const loadDevices = useExtHiveStore((s) => s.loadDevices)
  const setTargetDevice = useExtHiveStore((s) => s.setTargetDevice)
  const setTasksFilter = useExtHiveStore((s) => s.setTasksFilter)

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  const online = devices.filter((d) => d.status === 'online')
  const offline = devices.filter((d) => d.status !== 'online')

  const handleDeviceClick = (id: string): void => {
    setTargetDevice(id)
    setTasksFilter({ deviceId: id })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">
          Hive Fleet ({devices.length})
        </span>
        <button
          onClick={() => loadDevices()}
          disabled={devicesLoading}
          className="text-[10px] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer transition-colors disabled:opacity-50"
        >
          {devicesLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {devicesError && (
        <div className="px-3 py-2 text-[10px] text-red-400 border-b border-[var(--cos-border)]">
          {devicesError}
        </div>
      )}

      {/* Device list */}
      <div className="flex-1 overflow-y-auto">
        {devices.length === 0 && !devicesLoading && (
          <p className="px-3 py-4 text-xs text-[var(--cos-text-muted)] text-center">
            No devices registered.
            <br />
            Configure hive.url and hive.api-key in settings.
          </p>
        )}

        {online.length > 0 && (
          <>
            <div className="px-3 py-1.5">
              <span className="text-[10px] font-medium text-[var(--cos-text-muted)] uppercase tracking-wider">
                Online ({online.length})
              </span>
            </div>
            {online.map((d) => (
              <DeviceCard key={d.id} device={d} onClick={() => handleDeviceClick(d.id)} />
            ))}
          </>
        )}

        {offline.length > 0 && (
          <>
            <div className="px-3 py-1.5">
              <span className="text-[10px] font-medium text-[var(--cos-text-muted)] uppercase tracking-wider">
                Offline ({offline.length})
              </span>
            </div>
            {offline.map((d) => (
              <DeviceCard key={d.id} device={d} onClick={() => handleDeviceClick(d.id)} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
