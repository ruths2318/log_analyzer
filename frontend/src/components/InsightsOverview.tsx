import { useState } from 'react'

import type { PivotField } from '../eventFields'
import { useUploadInsights } from '../hooks/useUploadAnalysis'

type InsightsOverviewProps = {
  uploadId: string | null
  onOpenInsightsModal: () => void
  onAddPivot: (field: PivotField, value: string) => void
  onAddTimePivot: (start: string, end: string) => void
}

export function InsightsOverview({ uploadId, onOpenInsightsModal, onAddPivot, onAddTimePivot }: InsightsOverviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { data: insights, status, isLoading, isRegenerating, error, regenerate } = useUploadInsights(uploadId)

  if (!uploadId) {
    return null
  }

  const isPending = status === 'pending' || status === 'running'

  return (
    <section className="panel insights-overview-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <button className="ghost-button panel-collapse-button" type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div>
            <p className="section-label">SOC Insights</p>
            <h2>Priority findings</h2>
          </div>
        </div>
        <div className="panel-actions">
          {insights ? <span className="panel-note">Updated {new Date(insights.updatedAt).toLocaleString()}</span> : null}
          <button className="ghost-button" type="button" onClick={() => void regenerate()} disabled={isRegenerating}>
            {isRegenerating ? 'Regenerating…' : 'Regenerate insights'}
          </button>
          <button className="ghost-button" type="button" onClick={onOpenInsightsModal}>
            Open insights modal
          </button>
        </div>
      </div>

      {isCollapsed ? <p className="panel-note">Insights overview collapsed.</p> : null}
      {!isCollapsed && isLoading && !insights ? <p className="empty-state">Checking stored insights...</p> : null}
      {!isCollapsed && isPending ? (
        <div className="analysis-status-card">
          <strong>Insights are {status}.</strong>
          <p>Events are already available. This upload is still computing analyst summaries in the background.</p>
        </div>
      ) : null}
      {!isCollapsed && error && status === 'failed' ? <p className="error-text">{error}</p> : null}

      {!isCollapsed && insights ? (
        <div className="insights-overview-grid">
          <div className="atlas-spotlight-grid">
            {insights.spotlightCards.map((card) => (
              <article key={card.id} className={`spotlight-card spotlight-${card.severity}`}>
                <span className="metric-label">{card.title}</span>
                <strong>{card.value}</strong>
                <p>{card.context}</p>
                {card.timeRangeStart && card.timeRangeEnd ? (
                  <button className="ghost-button" type="button" onClick={() => onAddTimePivot(card.timeRangeStart!, card.timeRangeEnd!)}>
                    Time pivot
                  </button>
                ) : card.pivotField && card.pivotValue ? (
                  <button className="ghost-button" type="button" onClick={() => onAddPivot(card.pivotField as PivotField, card.pivotValue!)}>
                    Pivot
                  </button>
                ) : null}
              </article>
            ))}
          </div>
          <div className="findings-grid">
            {insights.keyFindings.slice(0, 4).map((finding, index) => (
              <article key={`${finding.title}-${index}`} className={`finding-card finding-${finding.severity}`}>
                <div className="finding-card-header">
                  <span className="metric-label">{finding.severity} priority</span>
                  {finding.timeRangeStart && finding.timeRangeEnd ? (
                    <button className="ghost-button" type="button" onClick={() => onAddTimePivot(finding.timeRangeStart!, finding.timeRangeEnd!)}>
                      Time pivot
                    </button>
                  ) : finding.pivotField && finding.pivotValue ? (
                    <button className="ghost-button" type="button" onClick={() => onAddPivot(finding.pivotField as PivotField, finding.pivotValue!)}>
                      Pivot
                    </button>
                  ) : null}
                </div>
                <h3>{finding.title}</h3>
                <p>{finding.detail}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
