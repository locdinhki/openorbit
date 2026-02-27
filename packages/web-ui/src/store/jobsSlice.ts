import type { StateCreator } from 'zustand'
import type { JobListing } from '../lib/types'

export interface JobsSlice {
  jobs: JobListing[]
  selectedJobId: string | null
  jobsLoading: boolean
  setJobs: (jobs: JobListing[]) => void
  selectJob: (id: string | null) => void
  setJobsLoading: (loading: boolean) => void
}

export const createJobsSlice: StateCreator<JobsSlice> = (set) => ({
  jobs: [],
  selectedJobId: null,
  jobsLoading: false,
  setJobs: (jobs) => set({ jobs }),
  selectJob: (selectedJobId) => set({ selectedJobId }),
  setJobsLoading: (loading) => set({ jobsLoading: loading })
})
