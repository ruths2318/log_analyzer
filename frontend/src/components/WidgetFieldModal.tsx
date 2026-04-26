import { useEffect, useState } from 'react'

import type { PivotField } from '../eventFields'
import type { InsightSection, UploadInsights, UploadInsightsResponse } from '../types'

type WidgetFieldModalProps = {
  uploadId: string | null
  onClose: () => void
  onAddWidget: (field: PivotField) => void
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
  pivots: Array<{ field: PivotField; value: string }>
}

function DistributionCard({
  section,
  pivots,
  onAddWidget,
  onAddPivot,
  onRemovePivot,
}: {
  section: InsightSection
  pivots: Array<{ field: PivotField; value: string }>
  onAddWidget: (field: PivotField) => void
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
}) {
  const canPivot = Boolean(section.pivotField)
  const pivotField = section.pivotField as PivotField | undefined

  return (
    <article className="atlas-card">
      <div className="atlas-card-header">
        <div>
          <p className="metric-label">Field distribution</p>
          <h3>{section.title}</h3>
          <p className="panel-note">{section.description}</p>
        </div>
        {canPivot && pivotField ? (
          <button className="ghost-button" type="button" onClick={() => onAddWidget(pivotField)}>
            Add widget
          </button>
        ) : null}
      </div>

      <div className="atlas-list">
        {section.items.map((item, index) => {
          const isActive = pivotField ? pivots.some((pivot) => pivot.field === pivotField && pivot.value === item.label) : false
          return (
            <button
              key={`${section.id}-${item.label}`}
              className={`atlas-row ${isActive ? 'is-active' : ''}${canPivot ? '' : ' is-readonly'}`}
              type="button"
              onClick={() => {
                if (!pivotField) {
                  return
                }
                if (isActive) {
                  onRemovePivot(pivotField, item.label)
                  return
                }
                onAddPivot(pivotField, item.label)
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
                <span>{pivotField ? (isActive ? 'Pivot active' : 'Pivot value') : 'Reference only'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </article>
  )
}

export function WidgetFieldModal({
  uploadId,
  onClose,
  onAddWidget,
  onAddPivot,
  onRemovePivot,
  pivots,
}: WidgetFieldModalProps) {
  const [insights, setInsights] = useState<UploadInsights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uploadId) {
      return
    }

    let isMounted = true
    void fetch(`/api/uploads/${uploadId}/insights`)
      .then(async (response) => {
        const payload = (await response.json()) as UploadInsightsResponse | { error?: string }
        if (!response.ok || !('insights' in payload)) {
          throw new Error(('error' in payload && payload.error) || 'Failed to load field distributions')
        }
        if (isMounted) {
          setInsights(payload.insights)
          setError(null)
        }
      })
      .catch((fetchError: unknown) => {
        if (isMounted) {
          setInsights(null)
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load field distributions')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [uploadId])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-surface atlas-modal" role="dialog" aria-modal="true" aria-label="Widget field analysis" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <p className="section-label">Widget analysis</p>
            <h2>Every structured field</h2>
          </div>
          <div className="panel-actions">
            {insights ? <span className="panel-note">{insights.fieldDistributions.length} fields</span> : null}
            <button className="ghost-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {isLoading ? <p className="empty-state">Loading field distributions...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {insights ? (
          <div className="atlas-grid">
            {insights.fieldDistributions.map((section) => (
              <DistributionCard
                key={section.id}
                section={section}
                pivots={pivots}
                onAddWidget={onAddWidget}
                onAddPivot={onAddPivot}
                onRemovePivot={onRemovePivot}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
