import { useEffect } from 'react'

import './App.css'
import { EventsPanel } from './components/EventsPanel'
import { SummaryGrid } from './components/SummaryGrid'
import { UploadPanel } from './components/UploadPanel'
import { UploadsPanel } from './components/UploadsPanel'
import { PAGE_SIZE, useLogAnalyzerStore } from './store/useLogAnalyzerStore'

function App() {
  const uploads = useLogAnalyzerStore((state) => state.uploads)
  const selectedUploadId = useLogAnalyzerStore((state) => state.selectedUploadId)
  const eventsResponse = useLogAnalyzerStore((state) => state.eventsResponse)
  const selectedFile = useLogAnalyzerStore((state) => state.selectedFile)
  const isLoadingUploads = useLogAnalyzerStore((state) => state.isLoadingUploads)
  const isLoadingEvents = useLogAnalyzerStore((state) => state.isLoadingEvents)
  const isUploading = useLogAnalyzerStore((state) => state.isUploading)
  const uploadError = useLogAnalyzerStore((state) => state.uploadError)
  const eventsError = useLogAnalyzerStore((state) => state.eventsError)
  const offset = useLogAnalyzerStore((state) => state.offset)
  const setSelectedFile = useLogAnalyzerStore((state) => state.setSelectedFile)
  const setSelectedUploadId = useLogAnalyzerStore((state) => state.setSelectedUploadId)
  const setOffset = useLogAnalyzerStore((state) => state.setOffset)
  const refreshUploads = useLogAnalyzerStore((state) => state.refreshUploads)
  const loadEvents = useLogAnalyzerStore((state) => state.loadEvents)
  const uploadFile = useLogAnalyzerStore((state) => state.uploadFile)

  useEffect(() => {
    void refreshUploads()
  }, [refreshUploads])

  useEffect(() => {
    if (!selectedUploadId) {
      return
    }
    void loadEvents(selectedUploadId, offset)
  }, [loadEvents, offset, selectedUploadId])

  function handleUpload() {
    void uploadFile()
  }

  const selectedUpload = uploads.find((upload) => upload.id === selectedUploadId) ?? eventsResponse?.upload ?? null
  const totalPages = eventsResponse ? Math.max(1, Math.ceil(eventsResponse.pagination.total / PAGE_SIZE)) : 1
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SOC Analyst Workspace</p>
          <h1>Proxy Log Intake</h1>
        </div>
        <div className="system-status">
          <span className="status-dot" />
          <span>Backend ready</span>
        </div>
      </header>

      <main className="layout">
        <section className="left-column">
          <UploadPanel
            selectedFile={selectedFile}
            isUploading={isUploading}
            uploadError={uploadError}
            onFileChange={setSelectedFile}
            onUpload={handleUpload}
          />
          <UploadsPanel
            uploads={uploads}
            selectedUploadId={selectedUploadId}
            isLoadingUploads={isLoadingUploads}
            onRefresh={() => void refreshUploads()}
            onSelectUpload={(uploadId) => {
              setSelectedUploadId(uploadId)
              setOffset(0)
            }}
          />
        </section>

        <section className="right-column">
          <SummaryGrid selectedUpload={selectedUpload} />
          <EventsPanel
            eventsResponse={eventsResponse}
            eventsError={eventsError}
            isLoadingEvents={isLoadingEvents}
            currentPage={currentPage}
            totalPages={totalPages}
            offset={offset}
            pageSize={PAGE_SIZE}
            onPrevPage={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            onNextPage={() => setOffset(offset + PAGE_SIZE)}
          />
        </section>
      </main>
    </div>
  )
}

export default App
