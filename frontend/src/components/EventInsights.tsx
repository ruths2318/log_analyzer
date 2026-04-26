import { useState } from 'react'

import { buildDistribution, EVENT_FIELD_OPTIONS, getFieldLabel, type PivotCondition, type PivotField } from '../eventFields'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LogEvent } from '../types'

type InsightWidget = {
  id: string
  field: PivotField
  view: 'bars' | 'pie'
}

type EventInsightsProps = {
  events: LogEvent[]
  widgets: InsightWidget[]
  pivots: PivotCondition[]
  onOpenFieldAtlas: () => void
  onFieldChange: (widgetId: string, field: PivotField) => void
  onViewChange: (widgetId: string, view: 'bars' | 'pie') => void
  onRemoveWidget: (widgetId: string) => void
  onAddWidget: (field: PivotField) => void
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
}

type InsightCardProps = {
  widget: InsightWidget
  events: LogEvent[]
  pivots: PivotCondition[]
  onFieldChange: (widgetId: string, field: PivotField) => void
  onViewChange: (widgetId: string, view: 'bars' | 'pie') => void
  onRemoveWidget: (widgetId: string) => void
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
}

function PieWidget({
  items,
  field,
  pivots,
  onAddPivot,
  onRemovePivot,
}: {
  items: ReturnType<typeof buildDistribution>
  field: PivotField
  pivots: PivotCondition[]
  onAddPivot: (field: PivotField, value: string) => void
  onRemovePivot: (field: PivotField, value: string) => void
}) {
  const palette = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9', '#38bdf8', '#bfdbfe']

  return (
    <div className="pie-widget">
      <div className="pie-ring">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="label" innerRadius={32} outerRadius={58} paddingAngle={2}>
              {items.map((item, index) => (
                <Cell key={`pie-${item.label}`} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(63,131,248,0.25)', borderRadius: '10px' }}
              labelStyle={{ color: '#bfdbfe' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pie-legend">
        {items.map((item, index) => {
          const isActive = pivots.some((pivot) => pivot.field === field && pivot.value === item.label)
          return (
            <button
              key={`${field}-pie-${item.label}`}
              className={`pie-legend-row ${isActive ? 'is-active' : ''}`}
              type="button"
              onClick={() => (isActive ? onRemovePivot(field, item.label) : onAddPivot(field, item.label))}
            >
              <span className="pie-swatch" style={{ background: palette[index % palette.length] }} />
              <div className="pie-legend-copy">
                <span className="overflow-slider">{item.label}</span>
                <strong>{Math.round(item.share * 100)}% · {item.value} events</strong>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function InsightCard({
  widget,
  events,
  pivots,
  onFieldChange,
  onViewChange,
  onRemoveWidget,
  onAddPivot,
  onRemovePivot,
}: InsightCardProps) {
  const items = buildDistribution(events, widget.field)
  const maxValue = items.reduce((current, item) => Math.max(current, item.value), 1)
  const palette = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9', '#38bdf8', '#bfdbfe']

  return (
    <article className="insight-card">
      <div className="insight-card-header">
        <div>
          <p className="metric-label">Value share</p>
          <h3>{getFieldLabel(widget.field)}</h3>
        </div>
        <div className="widget-controls">
          <label className="mini-select">
            <span>Column</span>
            <select value={widget.field} onChange={(event) => onFieldChange(widget.id, event.target.value as PivotField)}>
              {EVENT_FIELD_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented-toggle" role="tablist" aria-label="Widget view">
            <button
              className={`segment-button ${widget.view === 'bars' ? 'is-active' : ''}`}
              type="button"
              onClick={() => onViewChange(widget.id, 'bars')}
            >
              Bars
            </button>
            <button
              className={`segment-button ${widget.view === 'pie' ? 'is-active' : ''}`}
              type="button"
              onClick={() => onViewChange(widget.id, 'pie')}
            >
              Pie
            </button>
          </div>
          <button className="ghost-button widget-remove-button" type="button" onClick={() => onRemoveWidget(widget.id)}>
            Remove
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">No values to summarize for this selection.</p>
      ) : widget.view === 'pie' ? (
        <PieWidget items={items} field={widget.field} pivots={pivots} onAddPivot={onAddPivot} onRemovePivot={onRemovePivot} />
      ) : (
        <div className="insight-chart-shell">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={items} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="label" type="category" hide />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(63,131,248,0.25)', borderRadius: '10px' }}
                labelStyle={{ color: '#bfdbfe' }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {items.map((item, index) => (
                  <Cell key={`${widget.id}-bar-${item.label}`} fill={palette[index % palette.length]} />
                ))}
                <LabelList content={(props) => renderInlineBarLabel(props as unknown as Record<string, unknown>)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {items.map((item) => {
            const isActive = pivots.some((pivot) => pivot.field === widget.field && pivot.value === item.label)

            return (
              <button
                key={`${widget.field}-${item.label}`}
                className={`insight-row ${isActive ? 'is-active' : ''}`}
                type="button"
                onClick={() => {
                  if (isActive) {
                    onRemovePivot(widget.field, item.label)
                    return
                  }
                  onAddPivot(widget.field, item.label)
                }}
              >
                <div className="insight-labels">
                  <strong className="overflow-slider">{item.label}</strong>
                  <span>{Math.round(item.share * 100)}%</span>
                </div>
                <div className="insight-bar-track">
                  <div
                    className="insight-bar"
                    style={{
                      width: `${(item.value / maxValue) * 100}%`,
                      background: palette[items.indexOf(item) % palette.length],
                    }}
                  />
                </div>
                <div className="insight-meta">
                  <span>{item.value} events</span>
                  <span>{isActive ? 'Pivot active' : 'Add condition'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}

export function EventInsights({
  events,
  widgets,
  pivots,
  onOpenFieldAtlas,
  onFieldChange,
  onViewChange,
  onRemoveWidget,
  onAddWidget,
  onAddPivot,
  onRemovePivot,
}: EventInsightsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  return (
    <section className="panel insights-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <button className="ghost-button panel-collapse-button" type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div>
            <p className="section-label">Top values</p>
            <h2>Configurable pivots</h2>
          </div>
        </div>
        <div className="panel-actions">
          <button className="ghost-button" type="button" onClick={onOpenFieldAtlas}>
            See every column
          </button>
          <label className="mini-select">
            <span>New widget analysis</span>
            <select
              defaultValue=""
              onChange={(event) => {
                const nextField = event.target.value as PivotField
                if (!nextField) {
                  return
                }
                onAddWidget(nextField)
                event.target.value = ''
              }}
            >
              <option value="">New widget analysis</option>
              {EVENT_FIELD_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isCollapsed ? (
        <p className="panel-note">Widget analysis collapsed.</p>
      ) : (
        <div className="insight-grid">
          {widgets.map((widget) => (
            <InsightCard
              key={widget.id}
              widget={widget}
              events={events}
              pivots={pivots}
              onFieldChange={onFieldChange}
              onViewChange={onViewChange}
              onRemoveWidget={onRemoveWidget}
              onAddPivot={onAddPivot}
              onRemovePivot={onRemovePivot}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function renderInlineBarLabel(props: Record<string, unknown>) {
  const value = props.value ?? ''
  const payload = (props.payload ?? {}) as { label?: string }
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const width = Number(props.width ?? 0)
  const height = Number(props.height ?? 0)
  const label = payload?.label ?? ''
  const text = `${label} · ${value}`
  const fitsInside = width >= Math.max(120, text.length * 6.2)
  const textX = fitsInside ? x + width - 8 : x + width + 8
  const anchor = fitsInside ? 'end' : 'start'
  const fill = fitsInside ? '#eff6ff' : '#cbd5e1'

  return (
    <text x={textX} y={y + height / 2 + 4} fill={fill} fontSize={11} textAnchor={anchor}>
      {text}
    </text>
  )
}
