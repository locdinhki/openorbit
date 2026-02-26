interface SkeletonProps {
  lines?: number
  className?: string
}

export default function Skeleton({ lines = 3, className = '' }: SkeletonProps): React.JSX.Element {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-4 rounded animate-shimmer"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}
