import { useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { EXT_JOBS_IPC } from '../../ipc-channels'
import { ipc } from '../lib/ipc-client'
import { ipc as shellIpc } from '@renderer/lib/ipc-client'
import type { AutomationStatus, JobListing } from '@openorbit/core/types'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useAutomation() {
  const {
    automationState,
    sessionInitialized,
    currentAction,
    jobsExtracted,
    jobsAnalyzed,
    applicationsSubmitted,
    errors,
    platforms,
    setAutomationState,
    setSessionInitialized,
    setCurrentAction,
    updateStats,
    setPlatforms,
    addError,
    clearErrors,
    startSession
  } = useStore()

  const { addJob, setJobs, setJobsLoading } = useStore()

  // Load existing jobs from database on mount
  useEffect(() => {
    setJobsLoading(true)
    ipc.jobs
      .list()
      .then((result) => {
        if (result.success && result.data) {
          setJobs(result.data)
        }
      })
      .finally(() => setJobsLoading(false))
  }, [setJobs, setJobsLoading])

  // Listen for automation status updates from main process
  useEffect(() => {
    const cleanupStatus = window.api.on(EXT_JOBS_IPC.AUTOMATION_STATUS_PUSH, (status: unknown) => {
      const s = status as AutomationStatus
      setAutomationState(s.state)
      setCurrentAction(s.currentAction ?? null)
      updateStats({
        jobsExtracted: s.jobsExtracted,
        jobsAnalyzed: s.jobsAnalyzed,
        applicationsSubmitted: s.applicationsSubmitted,
        actionsPerMinute: s.actionsPerMinute
      })
      setPlatforms(s.platforms ?? [])
    })

    // Listen for new jobs pushed from main process
    const cleanupJobs = window.api.on(EXT_JOBS_IPC.JOBS_NEW, (job: unknown) => {
      addJob(job as JobListing)
    })

    return () => {
      cleanupStatus()
      cleanupJobs()
    }
  }, [setAutomationState, setCurrentAction, updateStats, setPlatforms, addJob])

  const initSession = useCallback(async () => {
    try {
      const result = await shellIpc.session.init()
      if (result.success) {
        setSessionInitialized(true)
      } else {
        addError(result.error ?? 'Failed to initialize session')
      }
      return result.success
    } catch (err) {
      addError(String(err))
      return false
    }
  }, [setSessionInitialized, addError])

  const startExtraction = useCallback(
    async (profileId?: string) => {
      clearErrors()
      startSession()

      // Ensure session is initialized
      if (!sessionInitialized) {
        const ok = await initSession()
        if (!ok) return false
      }

      const result = await ipc.automation.start(profileId)
      if (!result.success) {
        addError(result.error ?? 'Failed to start extraction')
      }
      return result.success
    },
    [sessionInitialized, initSession, clearErrors, startSession, addError]
  )

  const stopExtraction = useCallback(async () => {
    const result = await ipc.automation.stop()
    return result.success
  }, [])

  const pauseExtraction = useCallback(async () => {
    const result = await ipc.automation.pause()
    return result.success
  }, [])

  return {
    automationState,
    sessionInitialized,
    currentAction,
    jobsExtracted,
    jobsAnalyzed,
    applicationsSubmitted,
    errors,
    platforms,
    initSession,
    startExtraction,
    stopExtraction,
    pauseExtraction
  }
}
