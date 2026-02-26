import type { StateCreator } from 'zustand'
import type { JobListing } from '@openorbit/core/types'

export interface JobsSlice {
  jobs: JobListing[]
  selectedJobId: string | null
  jobsLoading: boolean
  setJobs: (jobs: JobListing[]) => void
  addJob: (job: JobListing) => void
  updateJob: (id: string, updates: Partial<JobListing>) => void
  removeJob: (id: string) => void
  selectJob: (id: string | null) => void
  setJobsLoading: (loading: boolean) => void
}

export const createJobsSlice: StateCreator<JobsSlice> = (set) => ({
  jobs: [],
  selectedJobId: null,
  jobsLoading: false,
  setJobs: (jobs) => set({ jobs }),
  addJob: (job) =>
    set((state) => {
      const idx = state.jobs.findIndex((j) => j.id === job.id)
      if (idx >= 0) {
        const updated = [...state.jobs]
        updated[idx] = job
        return { jobs: updated }
      }
      return { jobs: [job, ...state.jobs] }
    }),
  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j))
    })),
  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      selectedJobId: state.selectedJobId === id ? null : state.selectedJobId
    })),
  selectJob: (id) => set({ selectedJobId: id }),
  setJobsLoading: (loading) => set({ jobsLoading: loading })
})
