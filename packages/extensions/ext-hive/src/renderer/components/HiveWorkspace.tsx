// ============================================================================
// ext-hive — Workspace: Task Dispatch + History
// ============================================================================

import { useEffect } from 'react'
import { useExtHiveStore } from '../store/index'
import DispatchForm from './DispatchForm'
import TaskHistory from './TaskHistory'

export default function HiveWorkspace(): React.JSX.Element {
  const loadDevices = useExtHiveStore((s) => s.loadDevices)

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  return (
    <div className="flex flex-col h-full">
      {/* Dispatch Form */}
      <div className="p-4 border-b border-[var(--cos-border)]">
        <div className="text-xs font-medium text-[var(--cos-text-primary)] mb-3">Dispatch Task</div>
        <DispatchForm />
      </div>

      {/* Task History */}
      <div className="flex-1 min-h-0">
        <TaskHistory />
      </div>
    </div>
  )
}
