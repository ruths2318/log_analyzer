import { useRef } from 'react'

type UploadPanelProps = {
  selectedFile: File | null
  isUploading: boolean
  uploadError: string | null
  onFileChange: (file: File | null) => void
  onUpload: () => void
}

export function UploadPanel({
  selectedFile,
  isUploading,
  uploadError,
  onFileChange,
  onUpload,
}: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <section className="panel upload-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Ingest</p>
          <h2>Upload Zscaler log</h2>
        </div>
      </div>
      <div className="upload-form">
        <label className="file-picker">
          <span>{selectedFile ? selectedFile.name : 'Choose .log or .txt file'}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".log,.txt,.csv"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={isUploading}
          onClick={() => {
            if (!selectedFile) {
              fileInputRef.current?.click()
              return
            }
            onUpload()
          }}
        >
          {isUploading ? 'Uploading...' : selectedFile ? 'Upload and parse' : 'Choose file'}
        </button>
      </div>
      {uploadError ? <p className="error-text">{uploadError}</p> : null}
    </section>
  )
}
