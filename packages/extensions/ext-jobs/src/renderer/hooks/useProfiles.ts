import { useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { ipc } from '../lib/ipc-client'
import type { SearchProfile } from '@openorbit/core/types'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useProfiles() {
  const {
    profiles,
    selectedProfileId,
    profilesLoading,
    setProfiles,
    addProfile,
    updateProfile,
    removeProfile,
    selectProfile,
    setProfilesLoading
  } = useStore()

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true)
    try {
      const result = await ipc.profiles.list()
      if (result.success && result.data) {
        setProfiles(result.data)
      }
    } finally {
      setProfilesLoading(false)
    }
  }, [setProfiles, setProfilesLoading])

  const createProfile = useCallback(
    async (profile: Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
      const result = await ipc.profiles.create(profile)
      if (result.success && result.data) {
        addProfile(result.data)
        return result.data
      }
      throw new Error(result.error ?? 'Failed to create profile')
    },
    [addProfile]
  )

  const editProfile = useCallback(
    async (id: string, updates: Partial<Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const result = await ipc.profiles.update(id, updates)
      if (result.success && result.data) {
        updateProfile(id, result.data)
        return result.data
      }
      throw new Error(result.error ?? 'Failed to update profile')
    },
    [updateProfile]
  )

  const deleteProfile = useCallback(
    async (id: string) => {
      const result = await ipc.profiles.delete(id)
      if (result.success) {
        removeProfile(id)
      } else {
        throw new Error(result.error ?? 'Failed to delete profile')
      }
    },
    [removeProfile]
  )

  const toggleProfile = useCallback(
    async (id: string, enabled: boolean) => {
      await editProfile(id, { enabled })
    },
    [editProfile]
  )

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  return {
    profiles,
    selectedProfileId,
    profilesLoading,
    loadProfiles,
    createProfile,
    editProfile,
    deleteProfile,
    toggleProfile,
    selectProfile
  }
}
