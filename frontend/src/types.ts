export type Upload = {
  id: string
  userId: string | null
  ownerUsername: string | null
  originalFilename: string
  storagePath: string
  fileSizeBytes: number
  status: string
  errorMessage: string | null
  insightsStatus: string
  anomaliesStatus: string
  insightsErrorMessage: string | null
  anomaliesErrorMessage: string | null
  createdAt: string
  updatedAt: string
  eventCount: number
}

export type LogEvent = {
  id: string
  uploadId?: string
  rowNumber: number
  eventTime: string
  action: string
  protocol: string | null
  requestMethod: string | null
  url: string | null
  hostname: string | null
  urlCategory: string | null
  urlClass?: string | null
  urlSupercategory?: string | null
  userName: string | null
  clientIp: string | null
  serverIp?: string | null
  statusCode: number | null
  appName?: string | null
  appClass?: string | null
  department?: string | null
  location?: string | null
  userAgent?: string | null
  fileType?: string | null
  pageRisk: string | null
  threatCategory: string | null
  threatClass?: string | null
  threatName?: string | null
  rawEvent?: Record<string, string>
  createdAt?: string
}

export type EventsResponse = {
  upload: Upload
  events: LogEvent[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

export type AuthUser = {
  id: string
  username: string
  isAdmin: boolean
  createdAt: string
}

export type UserRecord = AuthUser

export type UploadsResponse = {
  uploads: Upload[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

export type InsightItem = {
  label: string
  value: number
  share: number
  pivotField?: string | null
  pivotValue?: string | null
}

export type InsightSection = {
  id: string
  title: string
  description: string
  fieldKey?: string | null
  pivotField?: string | null
  items: InsightItem[]
}

export type InsightFinding = {
  title: string
  detail: string
  severity: 'low' | 'medium' | 'high'
  pivotField?: string | null
  pivotValue?: string | null
  timeRangeStart?: string | null
  timeRangeEnd?: string | null
}

export type InsightSpotlightCard = {
  id: string
  title: string
  value: string
  context: string
  severity: 'low' | 'medium' | 'high'
  pivotField?: string | null
  pivotValue?: string | null
  timeRangeStart?: string | null
  timeRangeEnd?: string | null
}

export type UploadInsights = {
  uploadId: string
  analysisVersion: number
  summary: Record<string, number>
  spotlightCards: InsightSpotlightCard[]
  keyFindings: InsightFinding[]
  focusSections: InsightSection[]
  fieldDistributions: InsightSection[]
  generatedAt: string
  updatedAt: string
}

export type UploadInsightsResponse = {
  upload: Upload
  insights: UploadInsights
}

export type UploadInsightsPendingResponse = {
  upload: Upload
  status: string
  error?: string | null
}

export type UploadAnomaly = {
  id: string
  uploadId: string
  eventId: string | null
  rowNumber: number | null
  anomalyType: string
  title: string
  reason: string
  confidenceScore: number
  severity: 'low' | 'medium' | 'high'
  groupKey: string | null
  timeRangeStart: string | null
  timeRangeEnd: string | null
  context: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type UploadAnomaliesResponse = {
  upload: Upload
  anomalies: UploadAnomaly[]
}

export type UploadAnomaliesPendingResponse = {
  upload: Upload
  status: string
  error?: string | null
}
