import { useStore } from '../../store'

interface StatCard {
  label: string
  value: number | string
  color: string
}

export default function StatsCards(): React.JSX.Element {
  const jobsExtracted = useStore((s) => s.jobsExtracted)
  const jobsAnalyzed = useStore((s) => s.jobsAnalyzed)
  const applicationsSubmitted = useStore((s) => s.applicationsSubmitted)

  const successRate =
    jobsAnalyzed > 0 ? Math.round((applicationsSubmitted / jobsAnalyzed) * 100) : 0

  const cards: StatCard[] = [
    { label: 'Extracted', value: jobsExtracted, color: 'text-blue-400' },
    { label: 'Analyzed', value: jobsAnalyzed, color: 'text-indigo-400' },
    { label: 'Applied', value: applicationsSubmitted, color: 'text-green-400' },
    { label: 'Success Rate', value: `${successRate}%`, color: 'text-amber-400' }
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col items-center p-3 rounded-lg border border-[var(--cos-border)] bg-[var(--cos-bg-card)]"
        >
          <span className={`text-lg font-bold ${card.color}`}>{card.value}</span>
          <span className="text-[10px] text-[var(--cos-text-secondary)] mt-0.5">{card.label}</span>
        </div>
      ))}
    </div>
  )
}
