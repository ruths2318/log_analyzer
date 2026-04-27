import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { LogEvent } from '../types'

const TIMELINE_PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#f97316']

type ActivityTimelineProps = {
  events: LogEvent[]
  selectedBucketStart: string | null
  onBucketSelect: (bucket: { start: string; end: string } | null) => void
}

type TimelineGranularity = '1s' | '1m' | '15m' | '1h'
type TimelineView = 'bars' | 'line'

type TimelineBucket = {
  start: string
  end: string
  count: number
  blocked: number
  label: string
}

const GRANULARITY_OPTIONS: Array<{ value: TimelineGranularity; label: string; stepMs: number }> = [
  { value: '1s', label: 'Per second', stepMs: 1000 },
  { value: '1m', label: 'Per minute', stepMs: 60_000 },
  { value: '15m', label: 'Per 15 min', stepMs: 15 * 60_000 },
  { value: '1h', label: 'Per hour', stepMs: 60 * 60_000 },
]

function floorToBucket(timestamp: number, stepMs: number) {
  return Math.floor(timestamp / stepMs) * stepMs
}

function formatBucketAxis(start: string, granularity: TimelineGranularity) {
  const date = new Date(start)
  if (granularity === '1s' || granularity === '1m' || granularity === '15m') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: granularity === '1s' ? '2-digit' : undefined })
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatBucketContext(start: string, granularity: TimelineGranularity) {
  const date = new Date(start)
  if (granularity === '1s' || granularity === '1m' || granularity === '15m') {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActivityTimeline({ events, selectedBucketStart, onBucketSelect }: ActivityTimelineProps) {
  const [granularity, setGranularity] = useState<TimelineGranularity>('15m')
  const [view, setView] = useState<TimelineView>('bars')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const stepMs = GRANULARITY_OPTIONS.find((option) => option.value === granularity)?.stepMs ?? 15 * 60_000
  const bucketsByLabel = new Map<string, TimelineBucket>()

  for (const event of events) {
    const eventTime = new Date(event.eventTime).getTime()
    if (!Number.isFinite(eventTime)) {
      continue
    }
    const bucketStartMs = floorToBucket(eventTime, stepMs)
    const bucketStart = new Date(bucketStartMs).toISOString()
    const existing = bucketsByLabel.get(bucketStart)
    const isBlocked = event.action.toLowerCase() === 'blocked'

    if (existing) {
      existing.count += 1
      if (isBlocked) {
        existing.blocked += 1
      }
      continue
    }

    bucketsByLabel.set(bucketStart, {
      start: bucketStart,
      end: new Date(bucketStartMs + stepMs).toISOString(),
      count: 1,
      blocked: isBlocked ? 1 : 0,
      label: formatBucketAxis(bucketStart, granularity),
    })
  }

  const buckets = [...bucketsByLabel.values()].sort((left, right) => left.start.localeCompare(right.start))
  const anchorBucket = buckets[0]?.start ?? null

  return (
    <section className="panel timeline-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <button className="ghost-button panel-collapse-button" type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div>
            <p className="section-label">Activity profile</p>
            <h2>Timeline</h2>
          </div>
        </div>
        <div className="widget-controls">
          <label className="mini-select">
            <span>Bucket size</span>
            <select
              value={granularity}
              onChange={(event) => {
                setGranularity(event.target.value as TimelineGranularity)
                onBucketSelect(null)
              }}
            >
              {GRANULARITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented-toggle" role="tablist" aria-label="Timeline view">
            <button className={`segment-button ${view === 'bars' ? 'is-active' : ''}`} type="button" onClick={() => setView('bars')}>
              Bars
            </button>
            <button className={`segment-button ${view === 'line' ? 'is-active' : ''}`} type="button" onClick={() => setView('line')}>
              Graph
            </button>
          </div>
        </div>
      </div>

      {isCollapsed ? (
        <p className="panel-note">Timeline collapsed.</p>
      ) : buckets.length === 0 ? (
        <p className="empty-state">Load an upload to visualize request cadence.</p>
      ) : (
        <>
          <div className="timeline-header-row">
            <p className="panel-note">
              {anchorBucket ? formatBucketContext(anchorBucket, granularity) : ''} · aggregated by{' '}
              {GRANULARITY_OPTIONS.find((option) => option.value === granularity)?.label.toLowerCase()}
            </p>
            {selectedBucketStart ? (
              <button className="ghost-button" type="button" onClick={() => onBucketSelect(null)}>
                Clear time pivot
              </button>
            ) : null}
          </div>
          <div className="timeline-recharts-shell">
            <ResponsiveContainer width="100%" height={220}>
              {view === 'line' ? (
                <LineChart data={buckets} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="timelineLineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="33%" stopColor="#06b6d4" />
                      <stop offset="66%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={8} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(63,131,248,0.25)', borderRadius: '10px' }}
                    labelStyle={{ color: '#bfdbfe' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="url(#timelineLineGradient)"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 0, fill: '#f8fafc' }}
                    activeDot={{ r: 5, fill: '#93c5fd' }}
                  >
                    <LabelList dataKey="count" position="top" fill="#f8fafc" fontSize={11} />
                  </Line>
                </LineChart>
              ) : (
                <BarChart data={buckets} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={8} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(63,131,248,0.25)', borderRadius: '10px' }}
                    labelStyle={{ color: '#bfdbfe' }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[8, 8, 4, 4]}
                  >
                    {buckets.map((bucket) => (
                      <Cell
                        key={bucket.start}
                        fill={selectedBucketStart === bucket.start ? '#bfdbfe' : TIMELINE_PALETTE[buckets.indexOf(bucket) % TIMELINE_PALETTE.length]}
                      />
                    ))}
                    <LabelList dataKey="count" position="top" fill="#f8fafc" fontSize={11} />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
            <div className="timeline-hitbox-layer" aria-hidden="true">
              {buckets.map((bucket) => (
                <button
                  key={`hitbox-${bucket.start}`}
                  className={`timeline-hitbox ${selectedBucketStart === bucket.start ? 'is-active' : ''}`}
                  type="button"
                  onClick={() =>
                    onBucketSelect(selectedBucketStart === bucket.start ? null : { start: bucket.start, end: bucket.end })
                  }
                />
              ))}
            </div>
            <div className="timeline-axis">
              {buckets.map((bucket) => (
                <span key={`axis-${bucket.start}`} className={`timeline-axis-label ${selectedBucketStart === bucket.start ? 'is-active' : ''}`}>
                  {bucket.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
