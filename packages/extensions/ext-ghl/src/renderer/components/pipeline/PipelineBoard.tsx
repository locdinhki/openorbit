import { useEffect } from 'react'
import { useExtGhlStore } from '../../store/index'
import type { PipelineStage } from '../../../main/sdk/types'
import OpportunityCard from './OpportunityCard'

export default function PipelineBoard(): React.JSX.Element {
  const pipelines = useExtGhlStore((s) => s.pipelines)
  const selectedPipelineId = useExtGhlStore((s) => s.selectedPipelineId)
  const opportunities = useExtGhlStore((s) => s.opportunities)
  const oppsLoading = useExtGhlStore((s) => s.oppsLoading)
  const loadPipelines = useExtGhlStore((s) => s.loadPipelines)
  const selectPipeline = useExtGhlStore((s) => s.selectPipeline)

  useEffect(() => {
    loadPipelines()
  }, [loadPipelines])

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)
  const stages: PipelineStage[] = (() => {
    if (!selectedPipeline) return []
    try {
      return JSON.parse(selectedPipeline.stages)
    } catch {
      return []
    }
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline Selector */}
      {pipelines.length > 1 && (
        <div className="px-3 py-2 border-b border-[var(--cos-border)]">
          <select
            value={selectedPipelineId ?? ''}
            onChange={(e) => selectPipeline(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stages */}
      {oppsLoading ? (
        <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
          Loading...
        </div>
      ) : stages.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
          No pipelines synced. Click Sync to pull from GHL.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {stages
            .sort((a, b) => a.position - b.position)
            .map((stage) => {
              const stageOpps = opportunities.filter((o) => o.pipeline_stage_id === stage.id)
              return (
                <div key={stage.id} className="border-b border-[var(--cos-border)]">
                  <div className="px-3 py-1.5 bg-[var(--cos-bg-secondary)] flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider">
                      {stage.name}
                    </span>
                    <span className="text-[10px] text-[var(--cos-text-muted)]">
                      {stageOpps.length}
                    </span>
                  </div>
                  {stageOpps.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-[var(--cos-text-muted)]">
                      No opportunities
                    </div>
                  ) : (
                    stageOpps.map((opp) => <OpportunityCard key={opp.id} opportunity={opp} />)
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
