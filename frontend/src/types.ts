export type Upload = {
  id: string
  userId: string | null
  ownerUsername: string | null
  originalFilename: string
  storagePath: string
  fileSizeBytes: number
  status: string
  errorMessage: string | null
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
