import { useCallback, useEffect, useState } from 'react'

import type {
  UploadAiReview,
  UploadAiReviewPendingResponse,
  UploadAiReviewResponse,
  Upload,
  UploadAnomaliesPendingResponse,
  UploadAnomaliesResponse,
  UploadAnomaly,
  UploadInsights,
  UploadInsightsPendingResponse,
  UploadInsightsResponse,
} from '../types'

type AsyncStatus = 'idle' | 'pending' | 'running' | 'ready' | 'failed'

type AnalysisState<T> = {
  data: T | null
  upload: Upload | null
  status: AsyncStatus
  isLoading: boolean
  isRegenerating: boolean
  error: string | null
  refresh: () => Promise<void>
  regenerate: () => Promise<void>
}

const POLL_INTERVAL_MS = 3500

export function useUploadInsights(uploadId: string | null): AnalysisState<UploadInsights> {
  const [data, setData] = useState<UploadInsights | null>(null)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!uploadId) {
      setData(null)
      setUpload(null)
      setStatus('idle')
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/uploads/${uploadId}/insights`)
      if (response.status === 202 || response.status === 409 || response.status === 404) {
        const payload = (await response.json()) as UploadInsightsPendingResponse
        setUpload(payload.upload)
        setData(null)
        setStatus((payload.status as AsyncStatus) ?? (response.status === 202 ? 'pending' : 'failed'))
        setError(payload.error ?? null)
        return
      }

      const payload = (await response.json()) as UploadInsightsResponse | { error?: string }
      if (!response.ok || !('insights' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to load insights')
      }
      setUpload(payload.upload)
      setData(payload.insights)
      setStatus('ready')
      setError(null)
    } catch (fetchError: unknown) {
      setData(null)
      setStatus('failed')
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load insights')
    } finally {
      setIsLoading(false)
    }
  }, [uploadId])

  const regenerate = useCallback(async () => {
    if (!uploadId) {
      return
    }

    setIsRegenerating(true)
    setError(null)
    try {
      const response = await fetch(`/api/uploads/${uploadId}/insights/regenerate`, { method: 'POST' })
      const payload = (await response.json()) as UploadInsightsResponse | { upload?: Upload; error?: string }
      if (!response.ok || !('insights' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to regenerate insights')
      }
      setUpload(payload.upload)
      setData(payload.insights)
      setStatus('ready')
      setError(null)
    } catch (fetchError: unknown) {
      setStatus('failed')
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to regenerate insights')
    } finally {
      setIsRegenerating(false)
    }
  }, [uploadId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!uploadId || (status !== 'pending' && status !== 'running')) {
      return
    }

    const timer = window.setTimeout(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [refresh, status, uploadId])

  return { data, upload, status, isLoading, isRegenerating, error, refresh, regenerate }
}

export function useUploadAnomalies(uploadId: string | null): AnalysisState<UploadAnomaly[]> {
  const [data, setData] = useState<UploadAnomaly[] | null>(null)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!uploadId) {
      setData(null)
      setUpload(null)
      setStatus('idle')
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/uploads/${uploadId}/anomalies`)
      if (response.status === 202 || response.status === 409) {
        const payload = (await response.json()) as UploadAnomaliesPendingResponse
        setUpload(payload.upload)
        setData(null)
        setStatus((payload.status as AsyncStatus) ?? (response.status === 202 ? 'pending' : 'failed'))
        setError(payload.error ?? null)
        return
      }

      const payload = (await response.json()) as UploadAnomaliesResponse | { error?: string }
      if (!response.ok || !('anomalies' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to load anomalies')
      }
      setUpload(payload.upload)
      setData(payload.anomalies)
      setStatus('ready')
      setError(null)
    } catch (fetchError: unknown) {
      setData(null)
      setStatus('failed')
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load anomalies')
    } finally {
      setIsLoading(false)
    }
  }, [uploadId])

  const regenerate = useCallback(async () => {
    if (!uploadId) {
      return
    }

    setIsRegenerating(true)
    setError(null)
    try {
      const response = await fetch(`/api/uploads/${uploadId}/anomalies/regenerate`, { method: 'POST' })
      const payload = (await response.json()) as UploadAnomaliesResponse | { upload?: Upload; error?: string }
      if (!response.ok || !('anomalies' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to regenerate anomalies')
      }
      setUpload(payload.upload)
      setData(payload.anomalies)
      setStatus('ready')
      setError(null)
    } catch (fetchError: unknown) {
      setStatus('failed')
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to regenerate anomalies')
    } finally {
      setIsRegenerating(false)
    }
  }, [uploadId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!uploadId || (status !== 'pending' && status !== 'running')) {
      return
    }

    const timer = window.setTimeout(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [refresh, status, uploadId])

  return { data, upload, status, isLoading, isRegenerating, error, refresh, regenerate }
}

export function useUploadAiReview(uploadId: string | null): AnalysisState<UploadAiReview> {
  const [data, setData] = useState<UploadAiReview | null>(null)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!uploadId) {
      setData(null)
      setUpload(null)
      setStatus('idle')
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/uploads/${uploadId}/ai-review`)
      if (response.status === 202 || response.status === 409 || response.status === 404) {
        const payload = (await response.json()) as UploadAiReviewPendingResponse
        setUpload(payload.upload)
        setData(null)
        setStatus((payload.status as AsyncStatus) ?? (response.status === 202 ? 'pending' : 'failed'))
        setError(payload.error ?? null)
        return
      }

      const payload = (await response.json()) as UploadAiReviewResponse | { error?: string }
      if (!response.ok || !('aiReview' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to load AI review')
      }
      setUpload(payload.upload)
      setData(payload.aiReview)
      setStatus('ready')
      setError(null)
    } catch (fetchError: unknown) {
      setData(null)
      setStatus('failed')
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load AI review')
    } finally {
      setIsLoading(false)
    }
  }, [uploadId])

  const regenerate = useCallback(async () => {
    if (!uploadId) {
      return
    }

    setIsRegenerating(true)
    setError(null)
    try {
      const response = await fetch(`/api/uploads/${uploadId}/ai-review/regenerate`, { method: 'POST' })
      const payload = (await response.json()) as UploadAiReviewResponse | { upload?: Upload; error?: string }
      if (!response.ok || !('aiReview' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to regenerate AI review')
      }
      setUpload(payload.upload)
      setData(payload.aiReview)
      setStatus('ready')
      setError(null)
    } catch (fetchError: unknown) {
      setStatus('failed')
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to regenerate AI review')
    } finally {
      setIsRegenerating(false)
    }
  }, [uploadId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!uploadId || (status !== 'pending' && status !== 'running')) {
      return
    }

    const timer = window.setTimeout(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [refresh, status, uploadId])

  return { data, upload, status, isLoading, isRegenerating, error, refresh, regenerate }
}
