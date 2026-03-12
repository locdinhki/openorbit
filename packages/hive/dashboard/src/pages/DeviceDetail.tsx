import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, getToken, type Device, type Task } from '../lib/api'
import { relativeTime } from '../lib/time'
import StatusBadge from '../components/StatusBadge'

const Terminal = lazy(() => import('../components/Terminal'))

type Tab = 'info' | 'terminal'

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const [device, setDevice] = useState<Device | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('info')

  useEffect(() => {
    if (!id) return
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [id])

  async function load() {
    if (!id) return
    try {
      const [d, t] = await Promise.all([
        api.getDevice(id),
        api.listTasks({ deviceId: id, limit: 20 })
      ])
      setDevice(d)
      setTasks(t)
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="animate-pulse h-40 bg-gray-800/50 rounded-lg" />
  if (!device) return <p className="text-sm text-gray-500">Device not found</p>

  const hw = device.hardwareInfo as Record<string, unknown> | null
  const isOnline = device.status === 'online'
  const token = getToken()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/devices" className="text-xs text-gray-500 hover:text-gray-300">
          Devices
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-lg font-semibold">{device.name}</h1>
        <StatusBadge status={device.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'info'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Info
        </button>
        <button
          onClick={() => isOnline && setActiveTab('terminal')}
          disabled={!isOnline}
          title={!isOnline ? 'Device offline' : 'Open terminal'}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'terminal'
              ? 'border-blue-500 text-blue-400'
              : !isOnline
                ? 'border-transparent text-gray-700 cursor-not-allowed'
                : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Terminal
        </button>
      </div>

      {/* Terminal tab */}
      {activeTab === 'terminal' && isOnline && token && (
        <Suspense fallback={<div className="h-[400px] bg-[#0a0a0a] rounded-lg animate-pulse" />}>
          <Terminal deviceId={device.id} token={token} />
        </Suspense>
      )}

      {/* Info tab */}
      {activeTab === 'info' && (
        <>
          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoItem label="ID" value={device.id} />
            <InfoItem label="Type" value={device.type} />
            <InfoItem label="Status" value={device.status} />
            <InfoItem label="IP Address" value={device.ipAddress ?? '—'} />
            <InfoItem label="Location" value={device.locationTag ?? '—'} />
            <InfoItem label="Last Seen" value={relativeTime(device.lastSeenAt)} />
            <InfoItem label="Hardware ID" value={device.hardwareId?.slice(0, 16) + '...' || '—'} />
            <InfoItem label="Created" value={new Date(device.createdAt).toLocaleDateString()} />
          </div>

          {/* Hardware info */}
          {hw && (
            <div>
              <h2 className="text-sm font-medium text-gray-300 mb-3">Hardware</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(hw).map(([key, val]) => (
                  <InfoItem key={key} label={formatHwLabel(key)} value={formatHwValue(key, val)} />
                ))}
              </div>
            </div>
          )}

          {/* Recent tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-300">Recent Tasks</h2>
              <Link
                to={`/tasks/new?device=${device.id}`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Dispatch task
              </Link>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-gray-600">No tasks for this device</p>
            ) : (
              <div className="space-y-1">
                {tasks.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tasks/${t.id}`}
                    className="flex items-center justify-between p-2.5 bg-gray-900/30 border border-gray-800/50 rounded hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-mono">{t.id.slice(0, 8)}</span>
                      <span className="text-xs text-gray-300">
                        {(t.instruction as Record<string, unknown>).type as string}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={t.status} />
                      <span className="text-xs text-gray-600">{relativeTime(t.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const HW_LABELS: Record<string, string> = {
  os: 'OS',
  cpu: 'CPU',
  arch: 'Architecture',
  kernel: 'Kernel',
  memory: 'Memory',
  storage: 'Storage',
  network: 'Network',
  hostname: 'Hostname',
  platform: 'Platform',
  software: 'Software',
  hardwareId: 'Hardware ID',
  uptimeSeconds: 'Uptime',
  ip: 'IP Address',
  mac: 'MAC Address'
}

function formatHwLabel(key: string): string {
  return HW_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
}

function formatHwValue(key: string, val: unknown): string {
  if (val == null) return '—'
  if (typeof val !== 'object') {
    if (key === 'uptimeSeconds') {
      const s = Number(val)
      const d = Math.floor(s / 86400)
      const h = Math.floor((s % 86400) / 3600)
      const m = Math.floor((s % 3600) / 60)
      return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`
    }
    return String(val)
  }
  const obj = val as Record<string, unknown>
  switch (key) {
    case 'cpu':
      return `${obj.model ?? 'Unknown'} (${obj.cores ?? '?'} cores)`
    case 'memory':
      return `${formatMb(obj.availableMb)} free / ${formatMb(obj.totalMb)} total`
    case 'storage':
      return `${obj.freeGb ?? '?'} GB free / ${obj.totalGb ?? '?'} GB total`
    case 'network':
      return `${obj.ip ?? '—'}${obj.mac ? ` (${obj.mac})` : ''}`
    case 'software': {
      const entries = Object.entries(obj).filter(([, v]) => v && v !== 'not installed')
      return entries.map(([k, v]) => `${k} ${v}`).join(', ') || '—'
    }
    default:
      return JSON.stringify(val)
  }
}

function formatMb(val: unknown): string {
  const mb = Number(val)
  if (isNaN(mb)) return '?'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-white truncate" title={value}>
        {value}
      </p>
    </div>
  )
}
