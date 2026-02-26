// ============================================================================
// OpenOrbit — useSchedules Hook
// ============================================================================

import { useEffect, useCallback } from 'react'
import { useShellStore } from '../store/shell-store'
import { ipc } from './ipc-client'

export function useSchedules() {
  const {
    schedules,
    tools,
    schedulesLoading,
    executingScheduleIds,
    setSchedules,
    setTools,
    setSchedulesLoading,
    addScheduleToList,
    updateScheduleInList,
    removeScheduleFromList,
    markScheduleExecuting,
    markScheduleIdle,
    wizardOpen,
    editingScheduleId,
    openWizard,
    closeWizard
  } = useShellStore()

  const load = useCallback(async () => {
    setSchedulesLoading(true)
    try {
      const [schedResult, toolsResult] = await Promise.all([
        ipc.schedules.list(),
        ipc.scheduler.tools()
      ])
      if (schedResult.success && schedResult.data) setSchedules(schedResult.data)
      if (toolsResult.success && toolsResult.data) setTools(toolsResult.data)
    } finally {
      setSchedulesLoading(false)
    }
  }, [setSchedules, setTools, setSchedulesLoading])

  useEffect(() => {
    load()
  }, [load])

  // Subscribe to push events for live running indicators
  useEffect(() => {
    const cleanupStart = ipc.schedules.onRunStart((data) => {
      markScheduleExecuting(data.scheduleId)
    })

    const cleanupComplete = ipc.schedules.onRunComplete((data) => {
      markScheduleIdle(data.scheduleId)
      // Refresh schedule list to pick up updated lastRunStatus/lastRunAt
      load()
    })

    return () => {
      cleanupStart()
      cleanupComplete()
    }
  }, [markScheduleExecuting, markScheduleIdle, load])

  const createSchedule = useCallback(
    async (input: {
      name: string
      taskType: string
      cronExpression: string
      enabled?: boolean
      config?: Record<string, unknown>
    }) => {
      const result = await ipc.schedules.create(input)
      if (result.success && result.data) addScheduleToList(result.data)
      return result
    },
    [addScheduleToList]
  )

  const updateSchedule = useCallback(
    async (
      id: string,
      updates: Partial<{
        name: string
        cronExpression: string
        enabled: boolean
        config: Record<string, unknown>
      }>
    ) => {
      const result = await ipc.schedules.update(id, updates)
      if (result.success && result.data) updateScheduleInList(result.data)
      return result
    },
    [updateScheduleInList]
  )

  const deleteSchedule = useCallback(
    async (id: string) => {
      const result = await ipc.schedules.delete(id)
      if (result.success) removeScheduleFromList(id)
      return result
    },
    [removeScheduleFromList]
  )

  const toggleSchedule = useCallback(
    async (id: string, enabled: boolean) => {
      const result = await ipc.schedules.toggle(id, enabled)
      if (result.success && result.data) updateScheduleInList(result.data)
      return result
    },
    [updateScheduleInList]
  )

  const triggerSchedule = useCallback(async (id: string) => {
    return ipc.schedules.trigger(id)
  }, [])

  return {
    schedules,
    tools,
    loading: schedulesLoading,
    executingScheduleIds,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    triggerSchedule,
    refresh: load,
    wizardOpen,
    editingScheduleId,
    openWizard,
    closeWizard
  }
}
