import type { Upload } from '../types'
import { formatDateTime } from '../utils'

type UploadsPanelProps = {
  uploads: Upload[]
  selectedUploadId: string | null
  isLoadingUploads: boolean
  onRefresh: () => void
  onSelectUpload: (uploadId: string) => void
}

export function UploadsPanel({
  uploads,
  selectedUploadId,
  isLoadingUploads,
  onRefresh,
  onSelectUpload,
}: UploadsPanelProps) {
  return (
    <section className="panel uploads-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Recent uploads</p>
          <h2>Files</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {isLoadingUploads ? (
        <p className="empty-state">Loading uploads...</p>
      ) : uploads.length === 0 ? (
        <p className="empty-state">No files uploaded yet.</p>
      ) : (
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
              <p>{formatDateTime(upload.createdAt)}</p>
              <p>{upload.eventCount} events</p>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
