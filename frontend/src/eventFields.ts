import type { LogEvent } from './types'

export type PivotField =
  | 'action'
  | 'userName'
  | 'clientIp'
  | 'serverIp'
  | 'hostname'
  | 'urlCategory'
  | 'urlClass'
  | 'urlSupercategory'
  | 'requestMethod'
  | 'protocol'
  | 'appName'
  | 'appClass'
  | 'department'
  | 'location'
  | 'userAgent'
  | 'fileType'
  | 'riskLabel'
  | 'statusBand'
  | 'threatCategory'
  | 'threatClass'
  | 'threatName'

export type PivotCondition = {
  field: PivotField
  value: string
}

export type EventFieldOption = {
  key: PivotField
  label: string
  emptyLabel: string
}

export const EVENT_FIELD_OPTIONS: EventFieldOption[] = [
  { key: 'action', label: 'Action', emptyLabel: 'Unknown action' },
  { key: 'userName', label: 'User', emptyLabel: 'Unknown user' },
  { key: 'clientIp', label: 'Source IP', emptyLabel: 'Unknown IP' },
  { key: 'serverIp', label: 'Server IP', emptyLabel: 'Unknown server IP' },
  { key: 'hostname', label: 'Host', emptyLabel: 'Unknown host' },
  { key: 'urlCategory', label: 'Category', emptyLabel: 'Uncategorized' },
  { key: 'urlClass', label: 'URL class', emptyLabel: 'Unknown URL class' },
  { key: 'urlSupercategory', label: 'Supercategory', emptyLabel: 'Unknown supercategory' },
  { key: 'requestMethod', label: 'Method', emptyLabel: 'Unknown method' },
  { key: 'protocol', label: 'Protocol', emptyLabel: 'Unknown protocol' },
  { key: 'appName', label: 'App name', emptyLabel: 'Unknown app' },
  { key: 'appClass', label: 'App class', emptyLabel: 'Unknown app class' },
  { key: 'department', label: 'Department', emptyLabel: 'Unknown department' },
  { key: 'location', label: 'Location', emptyLabel: 'Unknown location' },
  { key: 'userAgent', label: 'User agent', emptyLabel: 'Unknown user agent' },
  { key: 'fileType', label: 'File type', emptyLabel: 'Unknown file type' },
  { key: 'riskLabel', label: 'Risk', emptyLabel: 'Low signal' },
  { key: 'statusBand', label: 'Status band', emptyLabel: 'Unknown' },
  { key: 'threatCategory', label: 'Threat category', emptyLabel: 'Unknown threat category' },
  { key: 'threatClass', label: 'Threat class', emptyLabel: 'Unknown threat class' },
  { key: 'threatName', label: 'Threat name', emptyLabel: 'Unknown threat name' },
]

export function getRiskLabel(event: LogEvent) {
  return event.pageRisk ?? event.threatCategory ?? 'Low signal'
}

export function getStatusBand(statusCode: number | null) {
  if (statusCode === null) {
    return 'Unknown'
  }
  if (statusCode >= 500) {
    return '5xx'
  }
  if (statusCode >= 400) {
    return '4xx'
  }
  if (statusCode >= 300) {
    return '3xx'
  }
  if (statusCode >= 200) {
    return '2xx'
  }
  return 'Other'
}

export function getFieldValue(event: LogEvent, field: PivotField) {
  switch (field) {
    case 'action':
      return event.action || 'Unknown action'
    case 'userName':
      return event.userName || 'Unknown user'
    case 'clientIp':
      return event.clientIp || 'Unknown IP'
    case 'serverIp':
      return event.serverIp || 'Unknown server IP'
    case 'hostname':
      return event.hostname || event.url || 'Unknown host'
    case 'urlCategory':
      return event.urlCategory || 'Uncategorized'
    case 'urlClass':
      return event.urlClass || 'Unknown URL class'
    case 'urlSupercategory':
      return event.urlSupercategory || 'Unknown supercategory'
    case 'requestMethod':
      return event.requestMethod || 'Unknown method'
    case 'protocol':
      return event.protocol || 'Unknown protocol'
    case 'appName':
      return event.appName || 'Unknown app'
    case 'appClass':
      return event.appClass || 'Unknown app class'
    case 'department':
      return event.department || 'Unknown department'
    case 'location':
      return event.location || 'Unknown location'
    case 'userAgent':
      return event.userAgent || 'Unknown user agent'
    case 'fileType':
      return event.fileType || 'Unknown file type'
    case 'riskLabel':
      return getRiskLabel(event)
    case 'statusBand':
      return getStatusBand(event.statusCode)
    case 'threatCategory':
      return event.threatCategory || 'Unknown threat category'
    case 'threatClass':
      return event.threatClass || 'Unknown threat class'
    case 'threatName':
      return event.threatName || 'Unknown threat name'
  }
}

export function getFieldLabel(field: PivotField) {
  return EVENT_FIELD_OPTIONS.find((option) => option.key === field)?.label ?? field
}

export function buildDistribution(events: LogEvent[], field: PivotField) {
  const fieldOption = EVENT_FIELD_OPTIONS.find((option) => option.key === field)
  const counts = new Map<string, number>()

  for (const event of events) {
    const key = getFieldValue(event, field) || fieldOption?.emptyLabel || 'Unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, share: events.length === 0 ? 0 : value / events.length }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6)
}

export function matchesPivot(event: LogEvent, condition: PivotCondition) {
  return getFieldValue(event, condition.field) === condition.value
}
