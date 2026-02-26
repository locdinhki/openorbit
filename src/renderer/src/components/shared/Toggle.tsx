// ============================================================================
// OpenOrbit — Toggle Component
// ============================================================================

interface ToggleProps {
  label?: string
  checked: boolean
  onChange: (checked: boolean) => void
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'w-7 h-3.5 after:h-2.5 after:w-2.5 peer-checked:after:translate-x-3',
  md: 'w-8 h-4 after:h-3 after:w-3 peer-checked:after:translate-x-4'
}

export default function Toggle({
  label,
  checked,
  onChange,
  size = 'md'
}: ToggleProps): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={`${sizeClasses[size]} bg-[var(--cos-border-light)] peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:transition-transform`}
        />
      </div>
      {label && (
        <span className="text-xs text-[var(--cos-text-secondary)]">{label}</span>
      )}
    </label>
  )
}
