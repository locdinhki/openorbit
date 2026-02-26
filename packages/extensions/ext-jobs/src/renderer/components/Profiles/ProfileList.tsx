import { useState } from 'react'
import type { SearchProfile } from '@openorbit/core/types'
import { useProfiles } from '../../hooks/useProfiles'
import { useAutomation } from '../../hooks/useAutomation'
import ProfileCard from './ProfileCard'
import ProfileEditor from './ProfileEditor'
import Button from '@renderer/components/shared/Button'

export default function ProfileList(): React.JSX.Element {
  const { profiles, profilesLoading, createProfile, editProfile, deleteProfile, toggleProfile } =
    useProfiles()
  const { startExtraction, automationState } = useAutomation()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<SearchProfile | undefined>(undefined)

  const handleCreate = (): void => {
    setEditingProfile(undefined)
    setEditorOpen(true)
  }

  const handleEdit = (profile: SearchProfile): void => {
    setEditingProfile(profile)
    setEditorOpen(true)
  }

  const handleSave = async (
    data: Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    if (editingProfile) {
      await editProfile(editingProfile.id, data)
    } else {
      await createProfile(data)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteProfile(id)
  }

  const handleRunNow = (id: string): void => {
    if (automationState === 'running') return
    startExtraction(id)
  }

  const enabledCount = profiles.filter((p) => p.enabled).length

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
          Search Profiles
        </h3>
        <Button size="sm" variant="primary" onClick={handleCreate}>
          + New
        </Button>
      </div>

      {/* Run All Enabled */}
      {enabledCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full mb-3"
          disabled={automationState === 'running'}
          onClick={() => {
            startExtraction()
          }}
        >
          Run All Enabled ({enabledCount})
        </Button>
      )}

      {/* Profile List */}
      {profilesLoading ? (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--cos-text-muted)]">Loading profiles...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--cos-text-muted)]">No profiles yet</p>
          <p className="text-xs text-[var(--cos-text-muted)] mt-1">
            Create a search profile to start finding jobs
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onToggle={toggleProfile}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRunNow={handleRunNow}
            />
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <ProfileEditor
        key={editingProfile?.id ?? 'new'}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        initial={editingProfile}
      />
    </div>
  )
}
