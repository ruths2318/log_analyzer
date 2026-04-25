import type { EventsResponse } from '../types'
import { formatDateTime } from '../utils'

type EventsPanelProps = {
  eventsResponse: EventsResponse | null
  eventsError: string | null
  isLoadingEvents: boolean
  currentPage: number
  totalPages: number
  offset: number
  pageSize: number
  onPrevPage: () => void
  onNextPage: () => void
}

export function EventsPanel({
  eventsResponse,
  eventsError,
  isLoadingEvents,
  currentPage,
  totalPages,
  offset,
  pageSize,
  onPrevPage,
  onNextPage,
}: EventsPanelProps) {
  return (
    <section className="panel events-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Parsed output</p>
          <h2>Events</h2>
        </div>
        {eventsResponse ? (
          <div className="pager">
            <button className="ghost-button" type="button" disabled={offset === 0 || isLoadingEvents} onClick={onPrevPage}>
              Prev
            </button>
            <span>
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="ghost-button"
              type="button"
              disabled={isLoadingEvents || offset + pageSize >= (eventsResponse.pagination.total ?? 0)}
              onClick={onNextPage}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {eventsError ? <p className="error-text">{eventsError}</p> : null}

      {isLoadingEvents ? (
        <p className="empty-state">Loading events...</p>
      ) : !eventsResponse ? (
        <p className="empty-state">Select an upload to inspect parsed events.</p>
      ) : (
        <div className="table-wrap">
          <table className="events-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Time</th>
                <th>Action</th>
                <th>User</th>
                <th>Source IP</th>
                <th>Host</th>
                <th>Category</th>
                <th>Status</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {eventsResponse.events.map((event) => (
                <tr key={event.id}>
                  <td>{event.rowNumber}</td>
                  <td>{formatDateTime(event.eventTime)}</td>
                  <td>
                    <span className={`badge badge-${event.action.toLowerCase()}`}>{event.action}</span>
                  </td>
                  <td>{event.userName ?? '-'}</td>
                  <td>{event.clientIp ?? '-'}</td>
                  <td className="wrap-cell">{event.hostname ?? event.url ?? '-'}</td>
                  <td>{event.urlCategory ?? '-'}</td>
                  <td>{event.statusCode ?? '-'}</td>
                  <td>{event.pageRisk ?? event.threatCategory ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
