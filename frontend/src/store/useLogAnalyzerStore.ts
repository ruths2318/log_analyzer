import { create } from 'zustand'

import type { EventsResponse, Upload } from '../types'

const PAGE_SIZE = 25

type LogAnalyzerState = {
  uploads: Upload[]
  selectedUploadId: string | null
  eventsResponse: EventsResponse | null
  selectedFile: File | null
  isLoadingUploads: boolean
  isLoadingEvents: boolean
  isUploading: boolean
  uploadError: string | null
  eventsError: string | null
  offset: number
  setSelectedFile: (file: File | null) => void
  setSelectedUploadId: (uploadId: string | null) => void
  setOffset: (offset: number) => void
  refreshUploads: (preferredUploadId?: string | null) => Promise<void>
  loadEvents: (uploadId: string, nextOffset: number) => Promise<void>
  uploadFile: () => Promise<void>
}

export const useLogAnalyzerStore = create<LogAnalyzerState>((set, get) => ({
  uploads: [],
  selectedUploadId: null,
  eventsResponse: null,
  selectedFile: null,
  isLoadingUploads: true,
  isLoadingEvents: false,
  isUploading: false,
  uploadError: null,
  eventsError: null,
  offset: 0,
  setSelectedFile: (file) => set({ selectedFile: file }),
  setSelectedUploadId: (uploadId) => set({ selectedUploadId: uploadId }),
  setOffset: (offset) => set({ offset }),
  refreshUploads: async (preferredUploadId) => {
    set({ isLoadingUploads: true, eventsError: null })

    try {
      const response = await fetch('/api/uploads')
      const payload = (await response.json()) as { uploads: Upload[] }

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
          selectedUploadId: nextSelectedUploadId,
          offset: nextSelectedUploadId !== state.selectedUploadId ? 0 : state.offset,
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
      const response = await fetch(`/api/uploads/${uploadId}/events?limit=${PAGE_SIZE}&offset=${nextOffset}`)
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
        uploads: [
          payload.upload,
          ...get().uploads.filter((upload) => upload.id !== payload.upload?.id),
        ],
        selectedFile: null,
        selectedUploadId: payload.upload.id,
        eventsResponse: null,
        offset: 0,
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

export { PAGE_SIZE }
