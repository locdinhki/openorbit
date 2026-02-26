import { useState, useEffect } from 'react'
import { ipc } from '@renderer/lib/ipc-client'
import Button from '@renderer/components/shared/Button'

interface ProfileData {
  name: string
  title: string
  location: string
  summary: string
  skills: string[]
  targetCompensation: string
  remotePreference: string
}

const DEFAULT_PROFILE: ProfileData = {
  name: '',
  title: '',
  location: '',
  summary: '',
  skills: [],
  targetCompensation: '',
  remotePreference: 'remote'
}

export default function UserProfile(): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      const result = await ipc.settings.get('user_profile')
      if (result.success && result.data) {
        try {
          const data = JSON.parse(result.data) as ProfileData
          setProfile({ ...DEFAULT_PROFILE, ...data })
        } catch {
          // ignore parse errors
        }
      }
    }
    loadProfile()
  }, [])

  const saveProfile = async (): Promise<void> => {
    setSaving(true)
    setSaved(false)
    await ipc.settings.update('user_profile', JSON.stringify(profile))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateField = (field: keyof ProfileData, value: string): void => {
    setProfile((p) => ({ ...p, [field]: value }))
  }

  const addSkill = (): void => {
    const trimmed = skillInput.trim()
    if (!trimmed || profile.skills.includes(trimmed)) return
    setProfile((p) => ({ ...p, skills: [...p.skills, trimmed] }))
    setSkillInput('')
  }

  const removeSkill = (skill: string): void => {
    setProfile((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }))
  }

  const inputClass =
    'w-full px-3 py-2 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-md text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500'

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-1">Your Profile</h3>
        <p className="text-xs text-[var(--cos-text-muted)]">
          Used to personalize job matching and application answers.
        </p>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
            Name
          </label>
          <input
            className={inputClass}
            value={profile.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="John Doe"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
            Title
          </label>
          <input
            className={inputClass}
            value={profile.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Senior Software Engineer"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
          Location
        </label>
        <input
          className={inputClass}
          value={profile.location}
          onChange={(e) => updateField('location', e.target.value)}
          placeholder="San Francisco, CA"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
          Summary
        </label>
        <textarea
          className={`${inputClass} resize-none`}
          rows={3}
          value={profile.summary}
          onChange={(e) => updateField('summary', e.target.value)}
          placeholder="Brief professional summary..."
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
          Skills
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {profile.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-600/15 text-indigo-400"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="text-indigo-400/60 hover:text-indigo-400 cursor-pointer"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            placeholder="Add a skill..."
          />
          <Button variant="secondary" size="sm" onClick={addSkill}>
            Add
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
          Target Compensation
        </label>
        <input
          className={inputClass}
          value={profile.targetCompensation}
          onChange={(e) => updateField('targetCompensation', e.target.value)}
          placeholder="$150k - $200k"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
          Remote Preference
        </label>
        <div className="flex gap-2">
          {['remote', 'hybrid', 'onsite', 'flexible'].map((pref) => (
            <button
              key={pref}
              onClick={() => updateField('remotePreference', pref)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border capitalize ${
                profile.remotePreference === pref
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400'
                  : 'bg-[var(--cos-bg-tertiary)] border-[var(--cos-border)] text-[var(--cos-text-secondary)]'
              }`}
            >
              {pref}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" size="md" onClick={saveProfile} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </Button>
        {saved && <span className="text-xs text-green-400">Saved!</span>}
      </div>
    </div>
  )
}
