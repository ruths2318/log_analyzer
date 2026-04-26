import { create } from 'zustand'

import type { AuthUser, EventsResponse, Upload, UploadsResponse, UserRecord } from '../types'

const DEFAULT_EVENT_PAGE_SIZE = 100
const UPLOAD_PAGE_SIZE = 12

type ActiveView = 'workspace' | 'admin'

type LogAnalyzerState = {
  currentUser: AuthUser | null
  isCheckingAuth: boolean
  isSubmittingAuth: boolean
  activeView: ActiveView
  uploads: Upload[]
  uploadsTotal: number
  uploadListOffset: number
  uploadOwnerFilter: string | null
  userSearch: string
  selectedUploadId: string | null
  eventsResponse: EventsResponse | null
  selectedFile: File | null
  isLoadingUploads: boolean
  isLoadingEvents: boolean
  isUploading: boolean
  uploadError: string | null
  eventsError: string | null
  authError: string | null
  eventOffset: number
  eventPageSize: number
  username: string
  password: string
  users: UserRecord[]
  usersError: string | null
  isLoadingUsers: boolean
  setUsername: (username: string) => void
  setPassword: (password: string) => void
  setSelectedFile: (file: File | null) => void
  setSelectedUploadId: (uploadId: string | null) => void
  setEventOffset: (offset: number) => void
  setEventPageSize: (pageSize: number) => void
  setUploadListOffset: (offset: number) => void
  setActiveView: (view: ActiveView) => void
  setUploadOwnerFilter: (userId: string | null) => void
  setUserSearch: (value: string) => void
  bootstrapAuth: () => Promise<void>
  login: () => Promise<void>
  register: () => Promise<void>
  logout: () => Promise<void>
  loadUsers: () => Promise<void>
  updateUserAdmin: (userId: string, isAdmin: boolean) => Promise<void>
  refreshUploads: (preferredUploadId?: string | null) => Promise<void>
  loadEvents: (uploadId: string, nextOffset: number) => Promise<void>
  uploadFile: () => Promise<void>
}

export const useLogAnalyzerStore = create<LogAnalyzerState>((set, get) => ({
  currentUser: null,
  isCheckingAuth: true,
  isSubmittingAuth: false,
  activeView: 'workspace',
  uploads: [],
  uploadsTotal: 0,
  uploadListOffset: 0,
  uploadOwnerFilter: null,
  userSearch: '',
  selectedUploadId: null,
  eventsResponse: null,
  selectedFile: null,
  isLoadingUploads: true,
  isLoadingEvents: false,
  isUploading: false,
  uploadError: null,
  eventsError: null,
  authError: null,
  eventOffset: 0,
  eventPageSize: DEFAULT_EVENT_PAGE_SIZE,
  username: '',
  password: '',
  users: [],
  usersError: null,
  isLoadingUsers: false,
  setUsername: (username) => set({ username }),
  setPassword: (password) => set({ password }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setSelectedUploadId: (uploadId) => set({ selectedUploadId: uploadId }),
  setEventOffset: (eventOffset) => set({ eventOffset }),
  setEventPageSize: (eventPageSize) => set({ eventPageSize, eventOffset: 0 }),
  setUploadListOffset: (uploadListOffset) => set({ uploadListOffset }),
  setActiveView: (activeView) => set({ activeView }),
  setUploadOwnerFilter: (uploadOwnerFilter) => set({ uploadOwnerFilter, uploadListOffset: 0 }),
  setUserSearch: (userSearch) => set({ userSearch }),
  bootstrapAuth: async () => {
    set({ isCheckingAuth: true, authError: null })
    try {
      const response = await fetch('/api/auth/me')
      const payload = (await response.json()) as { user: AuthUser | null }
      if (!response.ok) {
        throw new Error('Failed to check session')
      }
      set({ currentUser: payload.user })
      if (payload.user?.isAdmin) {
        await get().loadUsers()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check session'
      set({ authError: message, currentUser: null })
    } finally {
      set({ isCheckingAuth: false })
    }
  },
  login: async () => {
    const { username, password } = get()
    set({ authError: null, isSubmittingAuth: true })
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const payload = (await response.json()) as { user?: AuthUser; error?: string }
      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? 'Login failed')
      }
      set({
        currentUser: payload.user,
        username: '',
        password: '',
        authError: null,
        selectedUploadId: null,
        eventsResponse: null,
        uploadListOffset: 0,
        eventOffset: 0,
        eventPageSize: DEFAULT_EVENT_PAGE_SIZE,
        activeView: 'workspace',
        uploadOwnerFilter: null,
      })
      if (payload.user.isAdmin) {
        await get().loadUsers()
      }
      await get().refreshUploads()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      set({ authError: message, currentUser: null })
    } finally {
      set({ isSubmittingAuth: false })
    }
  },
  register: async () => {
    const { username, password } = get()
    set({ authError: null, isSubmittingAuth: true })
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const payload = (await response.json()) as { user?: AuthUser; error?: string }
      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? 'Registration failed')
      }
      set({
        currentUser: payload.user,
        username: '',
        password: '',
        authError: null,
        uploads: [],
        selectedUploadId: null,
        eventsResponse: null,
        uploadListOffset: 0,
        eventOffset: 0,
        eventPageSize: DEFAULT_EVENT_PAGE_SIZE,
        activeView: 'workspace',
        uploadOwnerFilter: null,
      })
      if (payload.user.isAdmin) {
        await get().loadUsers()
      }
      await get().refreshUploads()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      set({ authError: message, currentUser: null })
    } finally {
      set({ isSubmittingAuth: false })
    }
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    set({
      currentUser: null,
      activeView: 'workspace',
      uploads: [],
      uploadsTotal: 0,
      uploadListOffset: 0,
      uploadOwnerFilter: null,
      userSearch: '',
      selectedUploadId: null,
      eventsResponse: null,
      selectedFile: null,
      uploadError: null,
      eventsError: null,
      users: [],
      usersError: null,
      eventOffset: 0,
      eventPageSize: DEFAULT_EVENT_PAGE_SIZE,
    })
  },
  loadUsers: async () => {
    set({ isLoadingUsers: true, usersError: null })
    try {
      const response = await fetch('/api/users')
      const payload = (await response.json()) as { users: UserRecord[] }
      if (!response.ok) {
        throw new Error('Failed to load users')
      }
      set({ users: payload.users })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users'
      set({ usersError: message })
    } finally {
      set({ isLoadingUsers: false })
    }
  },
  updateUserAdmin: async (userId, isAdmin) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin }),
      })
      const payload = (await response.json()) as { user?: UserRecord; error?: string }
      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? 'Failed to update user')
      }
      const updatedUser = payload.user
      set((state) => ({
        users: state.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
        currentUser: state.currentUser?.id === updatedUser.id ? updatedUser : state.currentUser,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user'
      set({ usersError: message })
    }
  },
  refreshUploads: async (preferredUploadId) => {
    const { currentUser, activeView, uploadOwnerFilter, uploadListOffset } = get()
    set({ isLoadingUploads: true, eventsError: null })

    try {
      const params = new URLSearchParams({
        limit: String(UPLOAD_PAGE_SIZE),
        offset: String(uploadListOffset),
      })

      if (currentUser?.isAdmin && activeView === 'admin') {
        params.set('scope', 'all')
        if (uploadOwnerFilter) {
          params.set('ownerId', uploadOwnerFilter)
        }
      } else {
        params.set('scope', 'mine')
      }

      const response = await fetch(`/api/uploads?${params.toString()}`)
      const payload = (await response.json()) as UploadsResponse

      if (!response.ok) {
        throw new Error('Failed to load uploads')
      }

      set((state) => {
        const nextSelectedUploadId =
          payload.uploads.length === 0
            ? null
            : preferredUploadId && payload.uploads.some((upload) => upload.id === preferredUploadId)
              ? preferredUploadId
              : state.selectedUploadId && payload.uploads.some((upload) => upload.id === state.selectedUploadId)
                ? state.selectedUploadId
                : payload.uploads[0].id

        return {
          uploads: payload.uploads,
          uploadsTotal: payload.pagination.total,
          selectedUploadId: nextSelectedUploadId,
          eventOffset: nextSelectedUploadId !== state.selectedUploadId ? 0 : state.eventOffset,
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load uploads'
      set({ eventsError: message })
    } finally {
      set({ isLoadingUploads: false })
    }
  },
  loadEvents: async (uploadId, nextOffset) => {
    set({ isLoadingEvents: true, eventsError: null })

    try {
      const { eventPageSize } = get()
      const response = await fetch(`/api/uploads/${uploadId}/events?limit=${eventPageSize}&offset=${nextOffset}`)
      const payload = (await response.json()) as EventsResponse

      if (!response.ok) {
        throw new Error('Failed to load events')
      }

      set({ eventsResponse: payload })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load events'
      set({ eventsError: message })
    } finally {
      set({ isLoadingEvents: false })
    }
  },
  uploadFile: async () => {
    const selectedFile = get().selectedFile
    if (!selectedFile) {
      set({ uploadError: 'Choose a .log file first.' })
      return
    }

    set({ isUploading: true, uploadError: null })

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json()) as { upload?: Upload; error?: string }

      if (!response.ok || !payload.upload) {
        throw new Error(payload.error ?? 'Upload failed')
      }

      set({
        selectedFile: null,
        selectedUploadId: payload.upload.id,
        eventsResponse: null,
        uploadListOffset: 0,
        eventOffset: 0,
      })
      await get().refreshUploads(payload.upload.id)
      await get().loadEvents(payload.upload.id, 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      set({ uploadError: message })
    } finally {
      set({ isUploading: false })
    }
  },
}))

export { DEFAULT_EVENT_PAGE_SIZE, UPLOAD_PAGE_SIZE }
