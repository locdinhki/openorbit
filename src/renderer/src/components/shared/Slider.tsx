interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  className?: string
}

export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  className = ''
}: SliderProps): React.JSX.Element {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-[var(--cos-text-secondary)]">{label}</label>
        <span className="text-xs font-mono text-[var(--cos-text-muted)]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--cos-bg-tertiary)] accent-indigo-500"
      />
    </div>
  )
}
