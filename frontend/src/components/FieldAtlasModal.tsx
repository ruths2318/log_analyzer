import { getFieldLabel, getStatusBand, type PivotCondition, type PivotField } from '../eventFields'
import type { LogEvent } from '../types'

type FieldAtlasModalProps = {
  events: LogEvent[]
  pivots: PivotCondition[]
  onClose: () => void
  onAddWidget: (field: PivotField) => void
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
}

const ATLAS_PALETTE = ['#f97316', '#14b8a6', '#8b5cf6', '#eab308', '#ec4899', '#3b82f6', '#22c55e', '#ef4444']
const RAW_FIELD_KEYS = [
  'datetime',
  'reason',
  'event_id',
  'protocol',
  'action',
  'transactionsize',
  'responsesize',
  'requestsize',
  'ClientIP',
  'appclass',
  'appname',
  'bwthrottle',
  'clientpublicIP',
  'contenttype',
  'department',
  'devicehostname',
  'deviceowner',
  'dlpdictionaries',
  'dlpengine',
  'fileclass',
  'filetype',
  'hostname',
  'keyprotectiontype',
  'location',
  'pagerisk',
  'product',
  'refererURL',
  'requestmethod',
  'serverip',
  'status',
  'threatcategory',
  'threatclass',
  'threatname',
  'unscannabletype',
  'url',
  'urlcategory',
  'urlclass',
  'urlsupercategory',
  'user',
  'useragent',
  'vendor',
] as const

const RAW_KEY_TO_PIVOT_FIELD: Partial<Record<(typeof RAW_FIELD_KEYS)[number], PivotField>> = {
  protocol: 'protocol',
  action: 'action',
  ClientIP: 'clientIp',
  appclass: 'appClass',
  appname: 'appName',
  department: 'department',
  filetype: 'fileType',
  hostname: 'hostname',
  location: 'location',
  pagerisk: 'riskLabel',
  requestmethod: 'requestMethod',
  threatcategory: 'threatCategory',
  threatclass: 'threatClass',
  threatname: 'threatName',
  urlcategory: 'urlCategory',
  urlclass: 'urlClass',
  urlsupercategory: 'urlSupercategory',
  user: 'userName',
  useragent: 'userAgent',
  serverip: 'serverIp',
}

type AtlasFieldDefinition =
  | { kind: 'raw'; key: (typeof RAW_FIELD_KEYS)[number]; label: string; pivotField?: PivotField }
  | { kind: 'derived'; key: 'statusBand'; label: string; pivotField: PivotField }

const ATLAS_FIELDS: AtlasFieldDefinition[] = [
  ...RAW_FIELD_KEYS.map((key) => ({
    kind: 'raw' as const,
    key,
    label: key,
    pivotField: RAW_KEY_TO_PIVOT_FIELD[key],
  })),
  { kind: 'derived', key: 'statusBand', label: 'status band', pivotField: 'statusBand' },
]

function buildAtlasDistribution(events: LogEvent[], field: AtlasFieldDefinition) {
  const counts = new Map<string, number>()

  for (const event of events) {
    const value =
      field.kind === 'raw'
        ? event.rawEvent?.[field.key] || 'Unknown'
        : getStatusBand(event.statusCode)

    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, share: events.length === 0 ? 0 : value / events.length }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5)
}

export function FieldAtlasModal({
  events,
  pivots,
  onClose,
  onAddWidget,
  onAddPivot,
  onRemovePivot,
}: FieldAtlasModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-surface atlas-modal"
        role="dialog"
        aria-modal="true"
        aria-label="All column analysis"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <div>
            <p className="section-label">Field atlas</p>
            <h2>Every column analysis</h2>
          </div>
          <div className="panel-actions">
            <span className="panel-note">{ATLAS_FIELDS.length} fields</span>
            <button className="ghost-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="atlas-grid">
          {ATLAS_FIELDS.map((field) => {
            const items = buildAtlasDistribution(events, field)
            const fieldTitle = field.kind === 'raw' ? field.label : getFieldLabel(field.pivotField)
            return (
              <article key={field.key} className="atlas-card">
                <div className="atlas-card-header">
                  <div>
                    <p className="metric-label">{field.kind === 'raw' ? 'Raw column' : 'Derived field'}</p>
                    <h3>{fieldTitle}</h3>
                  </div>
                  {field.pivotField ? (
                    <button className="ghost-button" type="button" onClick={() => onAddWidget(field.pivotField!)}>
                      Add widget
                    </button>
                  ) : (
                    <span className="panel-note">Inspect only</span>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="empty-state">No values on current view.</p>
                ) : (
                  <div className="atlas-list">
                    {items.map((item, index) => {
                      const isActive = field.pivotField
                        ? pivots.some((pivot) => pivot.field === field.pivotField && pivot.value === item.label)
                        : false
                      return (
                        <button
                          key={`${field.key}-${item.label}`}
                          className={`atlas-row ${isActive ? 'is-active' : ''}${field.pivotField ? '' : ' is-readonly'}`}
                          type="button"
                          onClick={() => {
                            if (!field.pivotField) {
                              return
                            }
                            if (isActive) {
                              onRemovePivot(field.pivotField, item.label)
                              return
                            }
                            onAddPivot(field.pivotField, item.label)
                          }}
                        >
                          <div className="atlas-row-head">
                            <span className="atlas-swatch" style={{ background: ATLAS_PALETTE[index % ATLAS_PALETTE.length] }} />
                            <strong className="overflow-slider">{item.label}</strong>
                            <span>{Math.round(item.share * 100)}%</span>
                          </div>
                          <div className="atlas-bar-track">
                            <div
                              className="atlas-bar-fill"
                              style={{
                                width: `${item.share * 100}%`,
                                background: ATLAS_PALETTE[index % ATLAS_PALETTE.length],
                              }}
                            />
                          </div>
                          <div className="atlas-meta">
                            <span>{item.value} events</span>
                            <span>{field.pivotField ? (isActive ? 'Pivot active' : 'Pivot value') : 'Reference only'}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
