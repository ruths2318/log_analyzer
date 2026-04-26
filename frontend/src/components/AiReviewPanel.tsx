import { useEffect, useState } from 'react'

import type { SuggestedView, UploadAiReview } from '../types'

type AiReviewPanelProps = {
  review: UploadAiReview | null
  status: string
  isLoading: boolean
  isRegenerating: boolean
  error: string | null
  activeViewId: string | null
  hasRestorableView: boolean
  onRegenerate: () => void
  onSelectSuggestedView: (view: SuggestedView) => void
  onRestorePreviousView: () => void
}

export function AiReviewPanel({
  review,
  status,
  isLoading,
  isRegenerating,
  error,
  activeViewId,
  hasRestorableView,
  onRegenerate,
  onSelectSuggestedView,
  onRestorePreviousView,
}: AiReviewPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [localActiveViewId, setLocalActiveViewId] = useState<string | null>(review?.suggestedViews[0]?.id ?? null)
  const isPending = status === 'pending' || status === 'running'
  const resolvedActiveViewId = activeViewId ?? localActiveViewId
  const activeView = review?.suggestedViews.find((view) => view.id === resolvedActiveViewId) ?? review?.suggestedViews[0] ?? null

  useEffect(() => {
    if (!review?.suggestedViews.length) {
      const resetTimer = window.setTimeout(() => {
        setLocalActiveViewId(null)
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }
    const activateTimer = window.setTimeout(() => {
      setLocalActiveViewId((current) => current ?? review.suggestedViews[0].id)
    }, 0)
    return () => {
      window.clearTimeout(activateTimer)
    }
  }, [review])

  return (
    <section className="panel insights-overview-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <button className="ghost-button panel-collapse-button" type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div>
            <p className="section-label">AI Review</p>
            <h2>AI triage and suggested views</h2>
          </div>
        </div>
        <div className="panel-actions">
          {review ? <span className="panel-note">{review.provider ?? 'AI'} · {new Date(review.updatedAt).toLocaleString()}</span> : null}
          {hasRestorableView ? (
            <button className="ghost-button" type="button" onClick={onRestorePreviousView}>
              Back to my view
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={onRegenerate} disabled={isRegenerating}>
            {isRegenerating ? 'Regenerating…' : 'Regenerate AI review'}
          </button>
        </div>
      </div>

      {isCollapsed ? <p className="panel-note">AI review collapsed.</p> : null}
      {!isCollapsed && isLoading && !review ? <p className="empty-state">Checking stored AI review...</p> : null}
      {!isCollapsed && isPending ? (
        <div className="analysis-status-card">
          <strong>AI review is {status}.</strong>
          <p>The workspace is already usable. Suggested investigation tabs will appear once the AI review finishes.</p>
        </div>
      ) : null}
      {!isCollapsed && error && status === 'failed' ? <p className="error-text">{error}</p> : null}

      {!isCollapsed && review ? (
        <div className="ai-review-layout">
          <section className="ai-review-summary">
            <article className="spotlight-card spotlight-medium">
              <span className="metric-label">Executive summary</span>
              <p>{review.executiveSummary}</p>
            </article>
            <article className="spotlight-card spotlight-low">
              <span className="metric-label">Analyst summary</span>
              <p>{review.analystSummary}</p>
            </article>
            <div className="ai-review-list-grid">
              <article className="atlas-card">
                <div className="atlas-card-header">
                  <div>
                    <p className="metric-label">Top concerns</p>
                    <h3>Why AI is prioritizing this upload</h3>
                  </div>
                </div>
                <div className="ai-bullet-list">
                  {review.topConcerns.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </article>
              <article className="atlas-card">
                <div className="atlas-card-header">
                  <div>
                    <p className="metric-label">Next steps</p>
                    <h3>Recommended analyst actions</h3>
                  </div>
                </div>
                <div className="ai-bullet-list">
                  {review.recommendedNextSteps.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </article>
            </div>
          </section>

          {review.suggestedViews.length > 0 ? (
            <section className="ai-suggested-views">
              <div className="atlas-card-header">
                <div>
                  <p className="metric-label">Suggested tabs</p>
                  <h3>AI investigation lenses</h3>
                </div>
              </div>
              <div className="ai-tab-strip">
                {review.suggestedViews.map((view) => (
                  <button
                    key={view.id}
                    className={`ai-tab-button ${resolvedActiveViewId === view.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => {
                      setLocalActiveViewId(view.id)
                      onSelectSuggestedView(view)
                    }}
                  >
                    <strong>{view.title}</strong>
                    <span>{view.summary}</span>
                  </button>
                ))}
              </div>

              {activeView ? (
                <article className="atlas-card">
                  <div className="atlas-card-header">
                    <div>
                      <p className="metric-label">Selected view</p>
                      <h3>{activeView.title}</h3>
                      <p className="panel-note">{activeView.summary}</p>
                    </div>
                    <span className="panel-note">Selecting a tab applies it immediately.</span>
                  </div>
                  <div className="ai-view-details">
                    <div>
                      <p className="metric-label">Widgets</p>
                      <div className="active-pivots-list">
                        {activeView.widgets.map((widget) => (
                          <div key={widget} className="pivot-pill">
                            <strong>{widget}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="metric-label">Pivots</p>
                      <div className="active-pivots-list">
                        {activeView.pivots.map((pivot) => (
                          <div key={`${pivot.field}:${pivot.value}`} className="pivot-pill">
                            <span>{pivot.field}</span>
                            <strong>{pivot.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="metric-label">Table fields</p>
                      <div className="active-pivots-list">
                        {activeView.tableFields.map((field) => (
                          <div key={field} className="pivot-pill">
                            <strong>{field}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    {activeView.timeRange ? (
                      <div>
                        <p className="metric-label">Time range</p>
                        <p className="panel-note">
                          {new Date(activeView.timeRange.start).toLocaleString()} to {new Date(activeView.timeRange.end).toLocaleString()}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
