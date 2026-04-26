import type { Upload } from '../types'
import { formatDateTime } from '../utils'

type UploadsPanelProps = {
  title: string
  uploads: Upload[]
  uploadsTotal: number
  currentPage: number
  totalPages: number
  selectedUploadId: string | null
  isLoadingUploads: boolean
  ownerFilterLabel: string | null
  ownerFilterValue: string | null
  ownerFilterOptions: Array<{ id: string; username: string }>
  onChangeOwnerFilter?: (userId: string | null) => void
  onRefresh: () => void
  onSelectUpload: (uploadId: string) => void
  onPrevPage: () => void
  onNextPage: () => void
  canGoPrev: boolean
  canGoNext: boolean
  isCollapsed?: boolean
  onToggleCollapsed?: () => void
  collapsedSummary?: string
}

export function UploadsPanel({
  title,
  uploads,
  uploadsTotal,
  currentPage,
  totalPages,
  selectedUploadId,
  isLoadingUploads,
  ownerFilterLabel,
  ownerFilterValue,
  ownerFilterOptions,
  onChangeOwnerFilter,
  onRefresh,
  onSelectUpload,
  onPrevPage,
  onNextPage,
  canGoPrev,
  canGoNext,
  isCollapsed = false,
  onToggleCollapsed,
  collapsedSummary,
}: UploadsPanelProps) {
  return (
    <section className="panel uploads-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Recent uploads</p>
          <h2>{title}</h2>
        </div>
        <div className="panel-actions">
          {onToggleCollapsed ? (
            <button className="ghost-button" type="button" onClick={onToggleCollapsed}>
              {isCollapsed ? 'Show list' : 'Hide list'}
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {isCollapsed ? <p className="panel-note">{collapsedSummary ?? `${uploadsTotal} files available.`}</p> : null}

      {!isCollapsed && onChangeOwnerFilter && ownerFilterLabel ? (
        <label className="filter-field">
          <span>{ownerFilterLabel}</span>
          <select value={ownerFilterValue ?? ''} onChange={(event) => onChangeOwnerFilter(event.target.value || null)}>
            <option value="">All users</option>
            {ownerFilterOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!isCollapsed && isLoadingUploads ? (
        <p className="empty-state">Loading uploads...</p>
      ) : !isCollapsed && uploads.length === 0 ? (
        <p className="empty-state">No files uploaded yet.</p>
      ) : !isCollapsed ? (
        <div className="upload-list">
          {uploads.map((upload) => (
            <button
              key={upload.id}
              className={`upload-card ${upload.id === selectedUploadId ? 'is-selected' : ''}`}
              type="button"
              onClick={() => onSelectUpload(upload.id)}
            >
              <div className="upload-card-top">
                <strong>{upload.originalFilename}</strong>
                <span className={`badge badge-${upload.status}`}>{upload.status}</span>
              </div>
              <div className="upload-card-meta">
                <p>{formatDateTime(upload.createdAt)}</p>
                <p>{upload.ownerUsername ?? 'unknown owner'}</p>
              </div>
              <div className="upload-card-stats">
                <span>{upload.eventCount} events</span>
                <span>Updated {formatDateTime(upload.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!isCollapsed ? (
        <div className="panel-footer">
          <span className="footer-text">{uploadsTotal} total uploads</span>
          <div className="pager">
            <button className="ghost-button" type="button" disabled={!canGoPrev || isLoadingUploads} onClick={onPrevPage}>
              Prev
            </button>
            <span>
              Page {currentPage} / {totalPages}
            </span>
            <button className="ghost-button" type="button" disabled={!canGoNext || isLoadingUploads} onClick={onNextPage}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
