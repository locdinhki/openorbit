interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  max?: number
}

export default function Sparkline({
  values,
  width = 80,
  height = 24,
  color = '#22d3ee',
  max = 100
}: SparklineProps) {
  if (values.length < 2) {
    return <svg width={width} height={height} className="inline-block" />
  }

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - (Math.min(v, max) / max) * height
    return `${x},${y}`
  })

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
