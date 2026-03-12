import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { Device, DeviceMetric } from '../lib/api'
import { useLiveUpdates, type LiveEvent } from '../lib/use-live-updates'
import Sparkline from '../components/Sparkline'

function MetricBar({ value, color }: { value: number | null; color: string }) {
  if (value === null) return <span className="text-gray-600">—</span>
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums">{Math.round(value)}%</span>
    </div>
  )
}

interface DeviceMetrics {
  device: Device
  metrics: DeviceMetric[]
  latest: DeviceMetric | null
}

export default function Monitoring() {
  const [rows, setRows] = useState<DeviceMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const devices = await api.listDevices()
    const enriched = await Promise.all(
      devices.map(async (d) => {
        try {
          const metrics = await api.getMetrics(d.id, 60)
          return { device: d, metrics, latest: metrics[metrics.length - 1] ?? null }
        } catch {
          return { device: d, metrics: [], latest: null }
        }
      })
    )
    setRows(enriched)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Live metrics push — append new reading to the matching device row
  const handleLive = useCallback((evt: LiveEvent) => {
    if (evt.event === 'device.metrics') {
      const p = evt.payload as { deviceId: string; metrics: Record<string, number> }
      setRows((prev) =>
        prev.map((row) => {
          if (row.device.id !== p.deviceId) return row
          const fake: DeviceMetric = {
            id: '',
            deviceId: p.deviceId,
            recordedAt: new Date().toISOString(),
            cpuPercent: p.metrics.cpuPercent ?? null,
            memPercent: p.metrics.memPercent ?? null,
            memUsedMb: p.metrics.memUsedMb ?? null,
            memTotalMb: p.metrics.memTotalMb ?? null
          }
          const metrics = [...row.metrics, fake].slice(-60)
          return { ...row, metrics, latest: fake }
        })
      )
    } else if (evt.event === 'device.status') {
      const p = evt.payload as { deviceId: string; status: string }
      setRows((prev) =>
        prev.map((row) =>
          row.device.id === p.deviceId
            ? { ...row, device: { ...row.device, status: p.status } }
            : row
        )
      )
    }
  }, [])
  useLiveUpdates(handleLive)

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-6">Monitoring</h1>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No devices found.</p>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Device</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Status</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">CPU</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">RAM</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">CPU (1h)</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">RAM (1h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ device, metrics, latest }) => {
                const cpuValues = metrics.map((m) => m.cpuPercent ?? 0)
                const memValues = metrics.map((m) => m.memPercent ?? 0)
                const isExpanded = expanded === device.id

                return (
                  <>
                    <tr
                      key={device.id}
                      className="border-b border-gray-800/50 hover:bg-gray-900/30 cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : device.id)}
                    >
                      <td className="py-2.5 px-4 text-white">{device.name}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            device.status === 'online'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {device.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-300">
                        <MetricBar value={latest?.cpuPercent ?? null} color="#22d3ee" />
                      </td>
                      <td className="py-2.5 px-4 text-gray-300">
                        <MetricBar value={latest?.memPercent ?? null} color="#a78bfa" />
                      </td>
                      <td className="py-2.5 px-4">
                        {cpuValues.length > 1 ? (
                          <Sparkline values={cpuValues} color="#22d3ee" />
                        ) : (
                          <span className="text-gray-600 text-xs">no data</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {memValues.length > 1 ? (
                          <Sparkline values={memValues} color="#a78bfa" />
                        ) : (
                          <span className="text-gray-600 text-xs">no data</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${device.id}-detail`} className="border-b border-gray-800/50">
                        <td colSpan={6} className="px-4 py-3 bg-gray-900/50">
                          <div className="flex gap-8">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">CPU % (last 60 readings)</p>
                              <Sparkline
                                values={cpuValues}
                                width={200}
                                height={40}
                                color="#22d3ee"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">RAM % (last 60 readings)</p>
                              <Sparkline
                                values={memValues}
                                width={200}
                                height={40}
                                color="#a78bfa"
                              />
                            </div>
                            {latest?.memUsedMb != null && latest.memTotalMb != null && (
                              <div className="text-xs text-gray-400 self-end pb-1">
                                <p>
                                  RAM: {latest.memUsedMb} MB / {latest.memTotalMb} MB used
                                </p>
                                <p className="text-gray-600 mt-1">
                                  Updated: {new Date(latest.recordedAt).toLocaleTimeString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
