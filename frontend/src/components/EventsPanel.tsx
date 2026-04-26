import { useEffect, useMemo, useState } from 'react'

import { EVENT_FIELD_OPTIONS, getFieldLabel, getFieldValue, getRiskLabel, getStatusBand, type PivotCondition, type PivotField } from '../eventFields'
import type { EventsResponse, LogEvent, UploadAnomaly } from '../types'
import { formatDateTime } from '../utils'

type EventsPanelProps = {
  eventsResponse: EventsResponse | null
  filteredEvents: LogEvent[]
  eventsError: string | null
  isLoadingEvents: boolean
  currentPage: number
  totalPages: number
  offset: number
  pageSize: number
  pageSizeOptions: number[]
  onPageSizeChange: (pageSize: number) => void
  anomalyFilterEnabled: boolean
  anomalies: UploadAnomaly[]
  pivots: PivotCondition[]
  timeRangePivot: { start: string; end: string } | null
  tableFields: PivotField[]
  focusedRowNumber: number | null
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
  onAddWidget: (field: PivotField) => void
  onAddTableField: (field: PivotField) => void
  onClearTimePivot: () => void
  onClearPivots: () => void
  onPrevPage: () => void
  onNextPage: () => void
}

type ExpandedDetail =
  | { field: PivotField; label: string; value: string }
  | { label: string; value: string }

type SortField = 'rowNumber' | 'eventTime' | PivotField
type SortDirection = 'asc' | 'desc'

const PRIMARY_TABLE_FIELDS: PivotField[] = [
  'action',
  'userName',
  'clientIp',
  'requestMethod',
  'hostname',
  'urlCategory',
  'statusBand',
  'riskLabel',
]

const EXPANDED_FIELDS: Array<{ field: PivotField; label: string }> = EVENT_FIELD_OPTIONS.filter(
  (option) => !PRIMARY_TABLE_FIELDS.includes(option.key),
).map((option) => ({ field: option.key, label: option.label }))

type CellActionProps = {
  field: PivotField
  value: string
  pivots: PivotCondition[]
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
}

function CellActions({ field, value, pivots, onAddPivot, onRemovePivot }: CellActionProps) {
  const isActive = pivots.some((pivot) => pivot.field === field && pivot.value === value)
  return (
    <div className="cell-tooltip">
      <button
        className={`cell-action-button ${isActive ? 'is-active' : ''}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (isActive) {
            onRemovePivot(field, value)
            return
          }
          onAddPivot(field, value)
        }}
      >
        {isActive ? 'Unpivot' : 'Pivot'}
      </button>
    </div>
  )
}

function TableValue({
  field,
  value,
  pivots,
  onAddPivot,
  onRemovePivot,
}: {
  field: PivotField
  value: string
  pivots: PivotCondition[]
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
}) {
  return (
    <div className="cell-value-shell">
      <span className="overflow-slider">{value}</span>
      <CellActions field={field} value={value} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
    </div>
  )
}

export function EventsPanel({
  eventsResponse,
  filteredEvents,
  eventsError,
  isLoadingEvents,
  currentPage,
  totalPages,
  offset,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  anomalyFilterEnabled,
  anomalies,
  pivots,
  timeRangePivot,
  tableFields,
  focusedRowNumber,
  onAddPivot,
  onRemovePivot,
  onAddWidget,
  onAddTableField,
  onClearTimePivot,
  onClearPivots,
  onPrevPage,
  onNextPage,
}: EventsPanelProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sortField, setSortField] = useState<SortField>('eventTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const extraTableFields = tableFields.filter((field) => !PRIMARY_TABLE_FIELDS.includes(field))
  const tableColumnCount = 11 + extraTableFields.length
  const matchingAnomaliesByEventId = useMemo(() => {
    const grouped = new Map<string, UploadAnomaly[]>()
    for (const event of filteredEvents) {
      const matches = anomalies.filter((anomaly) => matchesAnomaly(event, anomaly))
      if (matches.length > 0) {
        grouped.set(event.id, matches)
      }
    }
    return grouped
  }, [anomalies, filteredEvents])
  const anomalyFilteredEvents = anomalyFilterEnabled
    ? filteredEvents.filter((event) => matchingAnomaliesByEventId.has(event.id))
    : filteredEvents
  const sortedEvents = [...anomalyFilteredEvents].sort((left, right) => {
    const leftValue = getSortableValue(left, sortField)
    const rightValue = getSortableValue(right, sortField)
    const comparison = compareValues(leftValue, rightValue)
    return sortDirection === 'asc' ? comparison : comparison * -1
  })

  useEffect(() => {
    if (focusedRowNumber === null) {
      return
    }
    const matchingEvent = sortedEvents.find((event) => event.rowNumber === focusedRowNumber)
    if (matchingEvent) {
      const timer = window.setTimeout(() => {
        setExpandedRowId(matchingEvent.id)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [focusedRowNumber, sortedEvents])

  function toggleSort(nextField: SortField) {
    if (sortField === nextField) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(nextField)
    setSortDirection(nextField === 'eventTime' ? 'asc' : 'desc')
  }

  return (
    <section className="panel events-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <button className="ghost-button panel-collapse-button" type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div>
            <p className="section-label">Parsed output</p>
            <h2>Events</h2>
          </div>
        </div>
        {eventsResponse ? (
          <div className="events-header-actions">
            <div className="pager">
              <span className="panel-note">{sortedEvents.length} rows visible</span>
              <label className="mini-select mini-select-inline">
                <span>Rows</span>
                <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
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
          </div>
        ) : null}
      </div>

      {pivots.length > 0 || timeRangePivot ? (
        <div className="active-pivots">
          <div className="active-pivots-list">
            {pivots.map((pivot) => (
              <div key={`${pivot.field}:${pivot.value}`} className="pivot-pill">
                <span>{getFieldLabel(pivot.field)}</span>
                <strong>{pivot.value}</strong>
                <button
                  className="pivot-remove-button"
                  type="button"
                  aria-label={`Remove ${getFieldLabel(pivot.field)} pivot`}
                  onClick={() => onRemovePivot(pivot.field, pivot.value)}
                >
                  x
                </button>
              </div>
            ))}
            {timeRangePivot ? (
              <div className="pivot-pill">
                <span>Time</span>
                <strong>{new Date(timeRangePivot.start).toLocaleString()}</strong>
                <button className="pivot-remove-button" type="button" aria-label="Remove time pivot" onClick={onClearTimePivot}>
                  x
                </button>
              </div>
            ) : null}
          </div>
          <button className="ghost-button" type="button" onClick={onClearPivots}>
            Clear all pivots
          </button>
        </div>
      ) : null}

      {eventsError ? <p className="error-text">{eventsError}</p> : null}
      {isCollapsed ? <p className="panel-note">Events table collapsed.</p> : null}

      {!isCollapsed && isLoadingEvents ? (
        <p className="empty-state">Loading events...</p>
      ) : !isCollapsed && !eventsResponse ? (
        <p className="empty-state">Select an upload to inspect parsed events.</p>
      ) : !isCollapsed && sortedEvents.length === 0 ? (
        <div className="empty-surface">
          <p className="empty-state">No events match the current filters.</p>
          <p className="panel-note">{anomalyFilterEnabled ? 'Try turning off anomaly-only mode or broadening your pivots.' : 'Remove one pivot or broaden the free-text filters.'}</p>
        </div>
      ) : !isCollapsed ? (
        <div className="table-wrap">
          <table className="events-table">
            <thead>
              <tr>
                <th />
                <th>{renderSortableHeader('Row', 'rowNumber', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Time', 'eventTime', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Action', 'action', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('User', 'userName', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Source IP', 'clientIp', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Method', 'requestMethod', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Host', 'hostname', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Category', 'urlCategory', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Status', 'statusBand', sortField, sortDirection, toggleSort)}</th>
                <th>{renderSortableHeader('Risk', 'riskLabel', sortField, sortDirection, toggleSort)}</th>
                {tableFields.filter((field) => !PRIMARY_TABLE_FIELDS.includes(field)).map((field) => (
                  <th key={`head-${field}`}>{renderSortableHeader(getFieldLabel(field), field, sortField, sortDirection, toggleSort)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedEvents.flatMap((event) => {
                const riskLabel = getRiskLabel(event)
                const statusBand = getStatusBand(event.statusCode)
                const isElevated = event.action.toLowerCase() === 'blocked' || Boolean(event.pageRisk || event.threatCategory)
                const eventAnomalies = matchingAnomaliesByEventId.get(event.id) ?? []
                const isAnomalous = eventAnomalies.length > 0
                const isExpanded = expandedRowId === event.id
                const detailFields: ExpandedDetail[] = [
                  ...EXPANDED_FIELDS.map((option) => ({
                    field: option.field,
                    label: option.label,
                    value: getFieldValue(event, option.field),
                  })),
                  { label: 'URL', value: event.url ?? '-' },
                  { label: 'Created at', value: event.createdAt ? formatDateTime(event.createdAt) : '-' },
                ]
                const rawEventEntries = Object.entries(event.rawEvent ?? {}).filter(([key]) => {
                  const normalizedKey = key.toLowerCase()
                  return ![
                    'action',
                    'protocol',
                    'requestmethod',
                    'url',
                    'hostname',
                    'urlcategory',
                    'user',
                    'clientip',
                    'status',
                    'pagerisk',
                    'threatcategory',
                  ].includes(normalizedKey)
                })

                return [
                  (
                    <tr
                      key={event.id}
                      className={`${isElevated ? 'is-elevated ' : ''}${isAnomalous ? 'is-anomalous ' : ''}${isExpanded ? 'is-expanded' : ''}`.trim() || undefined}
                      onClick={() => setExpandedRowId(isExpanded ? null : event.id)}
                    >
                      <td>
                        <button
                          className="ghost-button expand-row-button"
                          type="button"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            setExpandedRowId(isExpanded ? null : event.id)
                          }}
                        >
                          {isExpanded ? '-' : '+'}
                        </button>
                      </td>
                      <td>{event.rowNumber}</td>
                      <td>{formatDateTime(event.eventTime)}</td>
                      <td>
                        <div className="event-primary-cell">
                          <TableValue field="action" value={getFieldValue(event, 'action')} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                          {isAnomalous ? <span className="anomaly-inline-badge">Anomalous</span> : null}
                        </div>
                      </td>
                      <td>
                        <TableValue field="userName" value={getFieldValue(event, 'userName')} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                      </td>
                      <td>
                        <TableValue field="clientIp" value={getFieldValue(event, 'clientIp')} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                      </td>
                      <td>
                        <TableValue field="requestMethod" value={getFieldValue(event, 'requestMethod')} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                      </td>
                      <td className="wrap-cell">
                        <TableValue field="hostname" value={getFieldValue(event, 'hostname')} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                      </td>
                      <td>
                        <TableValue field="urlCategory" value={getFieldValue(event, 'urlCategory')} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                      </td>
                      <td>
                        <div className="status-stack">
                          <span>{event.statusCode ?? '-'}</span>
                          <TableValue field="statusBand" value={statusBand} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                        </div>
                      </td>
                      <td>
                        <TableValue field="riskLabel" value={riskLabel} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                      </td>
                      {extraTableFields.map((field) => (
                        <td key={`${event.id}-${field}`}>
                          <TableValue field={field} value={getFieldValue(event, field)} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
                        </td>
                      ))}
                    </tr>
                  ),
                  ...(isExpanded
                    ? [
                        <tr key={`${event.id}-expanded`} className="expanded-row">
                          <td colSpan={tableColumnCount}>
                            <div className="expanded-row-grid">
                              {eventAnomalies.length > 0 ? (
                                <div className="expanded-field expanded-field-anomaly expanded-field-span">
                                  <span className="metric-label">Anomaly evidence</span>
                                  <div className="expanded-anomaly-list">
                                    {eventAnomalies.map((anomaly) => (
                                      <article key={anomaly.id} className={`expanded-anomaly-card finding-${anomaly.severity}`}>
                                        <div className="expanded-anomaly-header">
                                          <strong>{anomaly.title}</strong>
                                          <span>{Math.round(anomaly.confidenceScore * 100)}% confidence</span>
                                        </div>
                                        <p>{anomaly.reason}</p>
                                      </article>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {detailFields.map((detail, index) => (
                                <div key={`${'field' in detail ? detail.field : detail.label}-${index}`} className="expanded-field">
                                  <span className="metric-label">{detail.label}</span>
                                  <div className="expanded-field-value">
                                    <span className="overflow-slider">{detail.value}</span>
                                    {'field' in detail && EVENT_FIELD_OPTIONS.some((option) => option.key === detail.field) ? (
                                      <div className="expanded-field-actions">
                                        <button
                                          className="ghost-button"
                                          type="button"
                                          onClick={() => onAddPivot(detail.field as PivotField, detail.value)}
                                        >
                                          Pivot
                                        </button>
                                        <button
                                          className="ghost-button"
                                          type="button"
                                          onClick={() => onAddWidget(detail.field)}
                                        >
                                          New widget analysis
                                        </button>
                                        <button
                                          className="ghost-button"
                                          type="button"
                                          onClick={() => onAddTableField(detail.field)}
                                        >
                                          Show in table
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                              {rawEventEntries.map(([key, value]) => (
                                <div key={`raw-${key}`} className="expanded-field expanded-field-raw">
                                  <span className="metric-label">{key}</span>
                                  <div className="expanded-field-value">
                                    <span className="overflow-slider">{value || '-'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>,
                      ]
                    : []),
                ]
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function renderSortableHeader(
  label: string,
  field: SortField,
  sortField: SortField,
  sortDirection: SortDirection,
  onToggle: (field: SortField) => void,
) {
  const isActive = sortField === field
  return (
    <button className={`table-sort-button ${isActive ? 'is-active' : ''}`} type="button" onClick={() => onToggle(field)}>
      <span>{label}</span>
      <span className="table-sort-indicator">{isActive ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  )
}

function getSortableValue(event: LogEvent, field: SortField) {
  if (field === 'rowNumber') {
    return event.rowNumber
  }
  if (field === 'eventTime') {
    return new Date(event.eventTime).getTime()
  }
  return getFieldValue(event, field)
}

function compareValues(left: string | number, right: string | number) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

function matchesAnomaly(event: LogEvent, anomaly: UploadAnomaly) {
  if (anomaly.eventId === event.id) {
    return true
  }
  if (anomaly.rowNumber !== null && anomaly.rowNumber === event.rowNumber) {
    return true
  }

  const context = anomaly.context as Record<string, unknown>
  const eventTime = new Date(event.eventTime).getTime()
  const startTime = anomaly.timeRangeStart ? new Date(anomaly.timeRangeStart).getTime() : null
  const endTime = anomaly.timeRangeEnd ? new Date(anomaly.timeRangeEnd).getTime() : null
  const inTimeWindow =
    startTime !== null && endTime !== null ? eventTime >= startTime && eventTime < endTime : true

  switch (anomaly.anomalyType) {
    case 'blocked_burst_by_ip':
    case 'request_burst_by_ip':
      return (
        inTimeWindow &&
        typeof context.clientIp === 'string' &&
        event.clientIp === context.clientIp &&
        (anomaly.anomalyType !== 'blocked_burst_by_ip' || event.action.toLowerCase() === 'blocked')
      )
    case 'user_destination_spread':
      return typeof context.userName === 'string' && event.userName === context.userName
    case 'error_spike_by_host':
      return (
        typeof context.hostname === 'string' &&
        event.hostname === context.hostname &&
        typeof event.statusCode === 'number' &&
        event.statusCode >= 400
      )
    case 'rare_user_host':
      return (
        typeof context.userName === 'string' &&
        typeof context.hostname === 'string' &&
        event.userName === context.userName &&
        event.hostname === context.hostname
      )
    default:
      return false
  }
}
