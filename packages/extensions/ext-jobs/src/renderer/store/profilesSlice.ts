import type { StateCreator } from 'zustand'
import type { SearchProfile } from '@openorbit/core/types'

export interface ProfilesSlice {
  profiles: SearchProfile[]
  selectedProfileId: string | null
  profilesLoading: boolean
  setProfiles: (profiles: SearchProfile[]) => void
  addProfile: (profile: SearchProfile) => void
  updateProfile: (id: string, updates: Partial<SearchProfile>) => void
  removeProfile: (id: string) => void
  selectProfile: (id: string | null) => void
  setProfilesLoading: (loading: boolean) => void
}

export const createProfilesSlice: StateCreator<ProfilesSlice> = (set) => ({
  profiles: [],
  selectedProfileId: null,
  profilesLoading: false,
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) => set((state) => ({ profiles: [...state.profiles, profile] })),
  updateProfile: (id, updates) =>
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p))
    })),
  removeProfile: (id) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      selectedProfileId: state.selectedProfileId === id ? null : state.selectedProfileId
    })),
  selectProfile: (id) => set({ selectedProfileId: id }),
  setProfilesLoading: (loading) => set({ profilesLoading: loading })
})
