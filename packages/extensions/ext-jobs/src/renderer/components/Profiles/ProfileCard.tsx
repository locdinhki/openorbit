import type { SearchProfile } from '@openorbit/core/types'
import Badge from '@renderer/components/shared/Badge'
import Button from '@renderer/components/shared/Button'

interface ProfileCardProps {
  profile: SearchProfile
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (profile: SearchProfile) => void
  onDelete: (id: string) => void
  onRunNow: (id: string) => void
}

const platformLabels: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  upwork: 'Upwork',
  dice: 'Dice',
  wellfound: 'Wellfound',
  glassdoor: 'Glassdoor'
}

export default function ProfileCard({
  profile,
  onToggle,
  onEdit,
  onDelete,
  onRunNow
}: ProfileCardProps): React.JSX.Element {
  return (
    <div className="p-3 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] hover:border-[var(--cos-border-light)] transition-colors">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{profile.name}</span>
          <Badge variant={profile.enabled ? 'success' : 'default'}>
            {profile.enabled ? 'Active' : 'Off'}
          </Badge>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={profile.enabled}
            onChange={(e) => onToggle(profile.id, e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-[var(--cos-border-light)] peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {/* Details */}
      <div className="text-xs text-[var(--cos-text-muted)] space-y-1 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="info">{platformLabels[profile.platform] ?? profile.platform}</Badge>
          {profile.search.remoteOnly && <Badge>Remote</Badge>}
          {profile.search.easyApplyOnly && <Badge variant="success">Easy Apply</Badge>}
        </div>
        <p className="truncate">
          {profile.search.keywords.length > 0
            ? profile.search.keywords.join(', ')
            : 'No keywords set'}
        </p>
        {profile.search.location.length > 0 && (
          <p className="truncate">{profile.search.location.join(', ')}</p>
        )}
        <p>
          {profile.search.jobType.join(', ')}
          {profile.search.salaryMin ? ` \u00b7 $${profile.search.salaryMin.toLocaleString()}+` : ''}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="primary" onClick={() => onRunNow(profile.id)}>
          Run Now
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(profile)}>
          Edit
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="danger" onClick={() => onDelete(profile.id)}>
          Delete
        </Button>
      </div>
    </div>
  )
}
