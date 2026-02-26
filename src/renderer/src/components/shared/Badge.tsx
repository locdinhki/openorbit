interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'score'
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<string, string> = {
  default: 'bg-[var(--cos-bg-hover)] text-[var(--cos-text-secondary)]',
  success: 'bg-green-600/20 text-green-400',
  warning: 'bg-amber-600/20 text-amber-400',
  error: 'bg-red-600/20 text-red-400',
  info: 'bg-blue-600/20 text-blue-400',
  score: 'bg-indigo-600/20 text-indigo-400'
}

export default function Badge({
  variant = 'default',
  children,
  className = ''
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
