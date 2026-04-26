import type { PivotField } from '../eventFields'
import { useUploadInsights } from '../hooks/useUploadAnalysis'
import type { InsightFinding } from '../types'

type FieldAtlasModalProps = {
  uploadId: string | null
  onClose: () => void
  onAddPivot: (field: PivotField, value: string) => void
  onAddTimePivot: (start: string, end: string) => void
}

function FindingCard({
  finding,
  onAddPivot,
  onAddTimePivot,
}: {
  finding: InsightFinding
  onAddPivot: (field: PivotField, value: string) => void
  onAddTimePivot: (start: string, end: string) => void
}) {
  return (
    <article className={`finding-card finding-${finding.severity}`}>
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
  )
}

export function FieldAtlasModal({ uploadId, onClose, onAddPivot, onAddTimePivot }: FieldAtlasModalProps) {
  const { data: insights, status, isLoading, isRegenerating, error, regenerate } = useUploadInsights(uploadId)
  const isPending = status === 'pending' || status === 'running'

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-surface atlas-modal" role="dialog" aria-modal="true" aria-label="SOC insights" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <p className="section-label">Stored analysis</p>
            <h2>SOC Insights</h2>
          </div>
          <div className="panel-actions">
            {insights ? <span className="panel-note">Generated {new Date(insights.generatedAt).toLocaleString()}</span> : null}
            <button className="ghost-button" type="button" onClick={() => void regenerate()} disabled={isRegenerating}>
              {isRegenerating ? 'Regenerating…' : 'Regenerate insights'}
            </button>
            <button className="ghost-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {isLoading && !insights ? <p className="empty-state">Loading persisted insights...</p> : null}
        {isPending ? (
          <div className="analysis-status-card">
            <strong>Insights are {status}.</strong>
            <p>The dashboard is polling for the persisted result. You can regenerate them immediately if needed.</p>
          </div>
        ) : null}
        {error && status === 'failed' ? <p className="error-text">{error}</p> : null}

        {insights ? (
          <div className="atlas-layout">
            <section className="atlas-section">
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
            </section>

            <section className="atlas-section">
              <div className="atlas-section-header">
                <div>
                  <p className="section-label">Key findings</p>
                  <h3>What to investigate first</h3>
                </div>
              </div>
              <div className="findings-grid">
                {insights.keyFindings.map((finding, index) => (
                  <FindingCard key={`${finding.title}-${index}`} finding={finding} onAddPivot={onAddPivot} onAddTimePivot={onAddTimePivot} />
                ))}
              </div>
            </section>

            <section className="atlas-section">
              <div className="atlas-section-header">
                <div>
                  <p className="section-label">Curated sections</p>
                  <h3>Analyst-first summaries</h3>
                </div>
              </div>
              <div className="atlas-grid">
                {insights.focusSections.map((section) => (
                  <article key={section.id} className="atlas-card">
                    <div className="atlas-card-header">
                      <div>
                        <p className="metric-label">Insight section</p>
                        <h3>{section.title}</h3>
                        <p className="panel-note">{section.description}</p>
                      </div>
                    </div>
                    <div className="atlas-list">
                      {section.items.map((item, index) => (
                        <button
                          key={`${section.id}-${item.label}`}
                          className="atlas-row"
                          type="button"
                          onClick={() => {
                            if (section.pivotField) {
                              onAddPivot(section.pivotField as PivotField, item.label)
                            }
                          }}
                        >
                          <div className="atlas-row-head">
                            <span className={`atlas-swatch atlas-swatch-${index % 6}`} />
                            <strong className="overflow-slider">{item.label}</strong>
                            <span>{Math.round(item.share * 100)}%</span>
                          </div>
                          <div className="atlas-bar-track">
                            <div className={`atlas-bar-fill atlas-bar-fill-${index % 6}`} style={{ width: `${item.share * 100}%` }} />
                          </div>
                          <div className="atlas-meta">
                            <span>{item.value} events</span>
                            <span>{section.pivotField ? 'Pivot value' : 'Reference only'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  )
}
