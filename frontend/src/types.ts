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
  rowNumber: number
  eventTime: string
  action: string
  protocol: string | null
  requestMethod: string | null
  url: string | null
  hostname: string | null
  urlCategory: string | null
  userName: string | null
  clientIp: string | null
  statusCode: number | null
  pageRisk: string | null
  threatCategory: string | null
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
