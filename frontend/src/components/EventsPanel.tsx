import { useState } from 'react'

import { EVENT_FIELD_OPTIONS, getFieldLabel, getFieldValue, getRiskLabel, getStatusBand, type PivotCondition, type PivotField } from '../eventFields'
import type { EventsResponse, LogEvent } from '../types'
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
  pivots: PivotCondition[]
  timeRangePivot: { start: string; end: string } | null
  tableFields: PivotField[]
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
  pivots,
  timeRangePivot,
  tableFields,
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
  const extraTableFields = tableFields.filter((field) => !PRIMARY_TABLE_FIELDS.includes(field))
  const tableColumnCount = 11 + extraTableFields.length

  return (
    <section className="panel events-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Parsed output</p>
          <h2>Events</h2>
        </div>
        {eventsResponse ? (
          <div className="events-header-actions">
            <div className="pager">
              <span className="panel-note">{filteredEvents.length} rows visible</span>
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

      {isLoadingEvents ? (
        <p className="empty-state">Loading events...</p>
      ) : !eventsResponse ? (
        <p className="empty-state">Select an upload to inspect parsed events.</p>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-surface">
          <p className="empty-state">No events match the current filters.</p>
          <p className="panel-note">Remove one pivot or broaden the free-text filters.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="events-table">
            <thead>
              <tr>
                <th />
                <th>Row</th>
                <th>Time</th>
                <th>Action</th>
                <th>User</th>
                <th>Source IP</th>
                <th>Method</th>
                <th>Host</th>
                <th>Category</th>
                <th>Status</th>
                <th>Risk</th>
                {tableFields.filter((field) => !PRIMARY_TABLE_FIELDS.includes(field)).map((field) => (
                  <th key={`head-${field}`}>{getFieldLabel(field)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.flatMap((event) => {
                const riskLabel = getRiskLabel(event)
                const statusBand = getStatusBand(event.statusCode)
                const isElevated = event.action.toLowerCase() === 'blocked' || Boolean(event.pageRisk || event.threatCategory)
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
                      className={`${isElevated ? 'is-elevated ' : ''}${isExpanded ? 'is-expanded' : ''}`.trim() || undefined}
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
                        <TableValue field="action" value={getFieldValue(event, 'action')} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
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
      )}
    </section>
  )
}
