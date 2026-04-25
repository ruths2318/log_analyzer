import type { Upload } from '../types'
import { formatBytes } from '../utils'

type SummaryGridProps = {
  selectedUpload: Upload | null
}

export function SummaryGrid({ selectedUpload }: SummaryGridProps) {
  return (
    <section className="summary-grid">
      <article className="summary-panel">
        <span className="metric-label">Selected upload</span>
        <strong>{selectedUpload?.originalFilename ?? 'None'}</strong>
      </article>
      <article className="summary-panel">
        <span className="metric-label">Status</span>
        <strong>{selectedUpload?.status ?? 'n/a'}</strong>
      </article>
      <article className="summary-panel">
        <span className="metric-label">Events</span>
        <strong>{selectedUpload?.eventCount ?? 0}</strong>
      </article>
      <article className="summary-panel">
        <span className="metric-label">Storage</span>
        <strong>{selectedUpload ? formatBytes(selectedUpload.fileSizeBytes) : '0 B'}</strong>
      </article>
    </section>
  )
}
