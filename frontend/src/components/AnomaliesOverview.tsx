import { useState } from 'react'

import type { PivotField } from '../eventFields'
import type { AnomalyAiReview, UploadAnomaly } from '../types'

type AnomaliesOverviewProps = {
  anomalies: UploadAnomaly[] | null
  status: string
  isLoading: boolean
  isRegenerating: boolean
  error: string | null
  onRegenerate: () => void
  anomalyReviewsById: Record<string, AnomalyAiReview>
  onAddPivot: (field: PivotField, value: string) => void
  onAddTimePivot: (start: string, end: string) => void
  onFocusRow: (rowNumber: number) => void
}

const ANOMALY_PIVOT_FIELDS: Partial<Record<string, PivotField>> = {
  blocked_burst_by_ip: 'clientIp',
  request_burst_by_ip: 'clientIp',
  user_destination_spread: 'userName',
  error_spike_by_host: 'hostname',
  rare_user_host: 'hostname',
}

export function AnomaliesOverview({
  anomalies,
  status,
  isLoading,
  isRegenerating,
  error,
  onRegenerate,
  anomalyReviewsById,
  onAddPivot,
  onAddTimePivot,
  onFocusRow,
}: AnomaliesOverviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const isPending = status === 'pending' || status === 'running'
  const topAnomalies = anomalies?.slice(0, 6) ?? []
  const rowLinkedCount =
    anomalies?.filter((anomaly) => anomaly.eventId !== null || anomaly.rowNumber !== null || anomaly.timeRangeStart !== null).length ?? 0

  return (
    <section className="panel insights-overview-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <button className="ghost-button panel-collapse-button" type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div>
            <p className="section-label">Anomalies</p>
            <h2>Flagged detections</h2>
          </div>
        </div>
        <div className="panel-actions">
          {anomalies ? <span className="panel-note">{anomalies.length} detections · {rowLinkedCount} table-linked</span> : null}
          <button className="ghost-button" type="button" onClick={onRegenerate} disabled={isRegenerating}>
            {isRegenerating ? 'Regenerating…' : 'Regenerate anomalies'}
          </button>
        </div>
      </div>

      {isCollapsed ? <p className="panel-note">Anomaly detections collapsed.</p> : null}
      {!isCollapsed && isLoading && !anomalies ? <p className="empty-state">Checking stored anomalies...</p> : null}
      {!isCollapsed && isPending ? (
        <div className="analysis-status-card">
          <strong>Anomalies are {status}.</strong>
          <p>The upload is already usable. Detection results will appear here as soon as the background analysis completes.</p>
        </div>
      ) : null}
      {!isCollapsed && error && status === 'failed' ? <p className="error-text">{error}</p> : null}
      {!isCollapsed && anomalies && anomalies.length === 0 && status === 'ready' ? <p className="empty-state">No anomalies were flagged for this upload.</p> : null}

      {!isCollapsed && topAnomalies.length > 0 ? (
        <div className="findings-grid">
          {topAnomalies.map((anomaly) => {
            const aiReview = anomalyReviewsById[anomaly.id]
            const pivotField = ANOMALY_PIVOT_FIELDS[anomaly.anomalyType]
            const pivotValue =
              anomaly.context.clientIp ??
              anomaly.context.userName ??
              anomaly.context.hostname ??
              anomaly.groupKey

            return (
              <article key={anomaly.id} className={`finding-card finding-${anomaly.severity}`}>
                <div className="finding-card-header">
                  <span className="metric-label">{Math.round(anomaly.confidenceScore * 100)}% confidence</span>
                  <div className="finding-card-actions">
                    {anomaly.rowNumber ? (
                      <button className="ghost-button" type="button" onClick={() => onFocusRow(anomaly.rowNumber!)}>
                        Focus row
                      </button>
                    ) : null}
                    {anomaly.timeRangeStart && anomaly.timeRangeEnd ? (
                      <button className="ghost-button" type="button" onClick={() => onAddTimePivot(anomaly.timeRangeStart!, anomaly.timeRangeEnd!)}>
                        Time pivot
                      </button>
                    ) : pivotField && typeof pivotValue === 'string' ? (
                      <button className="ghost-button" type="button" onClick={() => onAddPivot(pivotField, pivotValue)}>
                        Pivot
                      </button>
                    ) : null}
                  </div>
                </div>
                <h3>{anomaly.title}</h3>
                <p>{anomaly.reason}</p>
                {aiReview ? (
                  <div className="anomaly-ai-block">
                    <p className="panel-note">AI confidence {Math.round(aiReview.aiConfidenceScore * 100)}% · {aiReview.threatHypothesis}</p>
                    <p>{aiReview.aiSummary}</p>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
