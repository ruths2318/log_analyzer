import type { LogEvent, Upload } from '../types'
import { formatBytes, formatDateTime } from '../utils'

type SummaryGridProps = {
  selectedUpload: Upload | null
  events: LogEvent[]
  filteredEvents: LogEvent[]
}

export function SummaryGrid({ selectedUpload, events, filteredEvents }: SummaryGridProps) {
  const blockedEvents = events.filter((event) => event.action.toLowerCase() === 'blocked').length
  const riskyEvents = events.filter((event) => event.pageRisk || event.threatCategory).length
  const uniqueIps = new Set(events.map((event) => event.clientIp).filter(Boolean)).size
  const timestamps = events.map((event) => new Date(event.eventTime).getTime()).filter((value) => Number.isFinite(value))
  const firstSeen = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null
  const lastSeen = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null

  return (
    <section className="summary-grid">
      <article className="summary-panel">
        <span className="metric-label">Selected upload</span>
        <strong>{selectedUpload?.originalFilename ?? 'None'}</strong>
        <p>{selectedUpload ? formatBytes(selectedUpload.fileSizeBytes) : 'Waiting for ingest'}</p>
      </article>
      <article className="summary-panel">
        <span className="metric-label">Visible events</span>
        <strong>{filteredEvents.length}</strong>
        <p>{events.length} loaded on this page</p>
      </article>
      <article className="summary-panel">
        <span className="metric-label">Blocked actions</span>
        <strong>{blockedEvents}</strong>
        <p>{riskyEvents} rows with explicit risk signal</p>
      </article>
      <article className="summary-panel">
        <span className="metric-label">Distinct source IPs</span>
        <strong>{uniqueIps}</strong>
        <p>{selectedUpload?.eventCount ?? 0} total parsed events</p>
      </article>
      <article className="summary-panel summary-panel-wide">
        <span className="metric-label">Observation window</span>
        <strong>{firstSeen ? formatDateTime(firstSeen) : 'No data loaded'}</strong>
        <p>{lastSeen ? `Latest visible event ${formatDateTime(lastSeen)}` : 'Upload a file to inspect timeline coverage'}</p>
      </article>
    </section>
  )
}
