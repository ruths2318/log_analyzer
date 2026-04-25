import { useEffect } from 'react'

import './App.css'
import { EventsPanel } from './components/EventsPanel'
import { LoginPanel } from './components/LoginPanel'
import { SummaryGrid } from './components/SummaryGrid'
import { UploadPanel } from './components/UploadPanel'
import { UploadsPanel } from './components/UploadsPanel'
import { UsersPanel } from './components/UsersPanel'
import { EVENT_PAGE_SIZE, UPLOAD_PAGE_SIZE, useLogAnalyzerStore } from './store/useLogAnalyzerStore'

function App() {
  const currentUser = useLogAnalyzerStore((state) => state.currentUser)
  const isCheckingAuth = useLogAnalyzerStore((state) => state.isCheckingAuth)
  const isSubmittingAuth = useLogAnalyzerStore((state) => state.isSubmittingAuth)
  const activeView = useLogAnalyzerStore((state) => state.activeView)
  const uploads = useLogAnalyzerStore((state) => state.uploads)
  const uploadsTotal = useLogAnalyzerStore((state) => state.uploadsTotal)
  const uploadListOffset = useLogAnalyzerStore((state) => state.uploadListOffset)
  const uploadOwnerFilter = useLogAnalyzerStore((state) => state.uploadOwnerFilter)
  const userSearch = useLogAnalyzerStore((state) => state.userSearch)
  const selectedUploadId = useLogAnalyzerStore((state) => state.selectedUploadId)
  const eventsResponse = useLogAnalyzerStore((state) => state.eventsResponse)
  const selectedFile = useLogAnalyzerStore((state) => state.selectedFile)
  const isLoadingUploads = useLogAnalyzerStore((state) => state.isLoadingUploads)
  const isLoadingEvents = useLogAnalyzerStore((state) => state.isLoadingEvents)
  const isUploading = useLogAnalyzerStore((state) => state.isUploading)
  const uploadError = useLogAnalyzerStore((state) => state.uploadError)
  const eventsError = useLogAnalyzerStore((state) => state.eventsError)
  const authError = useLogAnalyzerStore((state) => state.authError)
  const users = useLogAnalyzerStore((state) => state.users)
  const usersError = useLogAnalyzerStore((state) => state.usersError)
  const isLoadingUsers = useLogAnalyzerStore((state) => state.isLoadingUsers)
  const eventOffset = useLogAnalyzerStore((state) => state.eventOffset)
  const username = useLogAnalyzerStore((state) => state.username)
  const password = useLogAnalyzerStore((state) => state.password)
  const setUsername = useLogAnalyzerStore((state) => state.setUsername)
  const setPassword = useLogAnalyzerStore((state) => state.setPassword)
  const setSelectedFile = useLogAnalyzerStore((state) => state.setSelectedFile)
  const setSelectedUploadId = useLogAnalyzerStore((state) => state.setSelectedUploadId)
  const setEventOffset = useLogAnalyzerStore((state) => state.setEventOffset)
  const setUploadListOffset = useLogAnalyzerStore((state) => state.setUploadListOffset)
  const setActiveView = useLogAnalyzerStore((state) => state.setActiveView)
  const setUploadOwnerFilter = useLogAnalyzerStore((state) => state.setUploadOwnerFilter)
  const setUserSearch = useLogAnalyzerStore((state) => state.setUserSearch)
  const bootstrapAuth = useLogAnalyzerStore((state) => state.bootstrapAuth)
  const login = useLogAnalyzerStore((state) => state.login)
  const register = useLogAnalyzerStore((state) => state.register)
  const logout = useLogAnalyzerStore((state) => state.logout)
  const loadUsers = useLogAnalyzerStore((state) => state.loadUsers)
  const updateUserAdmin = useLogAnalyzerStore((state) => state.updateUserAdmin)
  const refreshUploads = useLogAnalyzerStore((state) => state.refreshUploads)
  const loadEvents = useLogAnalyzerStore((state) => state.loadEvents)
  const uploadFile = useLogAnalyzerStore((state) => state.uploadFile)

  useEffect(() => {
    void bootstrapAuth()
  }, [bootstrapAuth])

  useEffect(() => {
    if (!currentUser) {
      return
    }
    void refreshUploads()
  }, [activeView, currentUser, refreshUploads, uploadListOffset, uploadOwnerFilter])

  useEffect(() => {
    if (!currentUser || !selectedUploadId) {
      return
    }
    void loadEvents(selectedUploadId, eventOffset)
  }, [currentUser, eventOffset, loadEvents, selectedUploadId])

  function handleUpload() {
    void uploadFile()
  }

  function handleLogin() {
    void login()
  }

  function handleRegister() {
    void register()
  }

  function handleLogout() {
    void logout()
  }

  const selectedUpload = uploads.find((upload) => upload.id === selectedUploadId) ?? eventsResponse?.upload ?? null
  const totalPages = eventsResponse ? Math.max(1, Math.ceil(eventsResponse.pagination.total / EVENT_PAGE_SIZE)) : 1
  const currentPage = Math.floor(eventOffset / EVENT_PAGE_SIZE) + 1
  const uploadTotalPages = Math.max(1, Math.ceil(uploadsTotal / UPLOAD_PAGE_SIZE))
  const uploadCurrentPage = Math.floor(uploadListOffset / UPLOAD_PAGE_SIZE) + 1
  const filteredUsers = users.filter((user) => user.username.toLowerCase().includes(userSearch.trim().toLowerCase()))

  if (isCheckingAuth) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <p className="empty-state">Checking session...</p>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <LoginPanel
        username={username}
        password={password}
        authError={authError}
        isSubmitting={isSubmittingAuth}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">SOC Analyst Workspace</p>
          <h1>Proxy Log Intake</h1>
          {currentUser.isAdmin ? (
            <div className="view-switcher">
              <button
                className={`nav-button ${activeView === 'workspace' ? 'is-active' : ''}`}
                type="button"
                onClick={() => {
                  setActiveView('workspace')
                  setUploadOwnerFilter(null)
                  setUploadListOffset(0)
                }}
              >
                My workspace
              </button>
              <button
                className={`nav-button ${activeView === 'admin' ? 'is-active' : ''}`}
                type="button"
                onClick={() => {
                  setActiveView('admin')
                  setUploadListOffset(0)
                  void loadUsers()
                }}
              >
                Admin
              </button>
            </div>
          ) : null}
        </div>
        <div className="system-status">
          <span className="status-dot" />
          <span>{currentUser.username}{currentUser.isAdmin ? ' · admin' : ''}</span>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="left-column">
          {activeView === 'workspace' ? (
            <>
              <UploadPanel
                selectedFile={selectedFile}
                isUploading={isUploading}
                uploadError={uploadError}
                onFileChange={setSelectedFile}
                onUpload={handleUpload}
              />
              <UploadsPanel
                title="My uploads"
                uploads={uploads}
                uploadsTotal={uploadsTotal}
                currentPage={uploadCurrentPage}
                totalPages={uploadTotalPages}
                selectedUploadId={selectedUploadId}
                isLoadingUploads={isLoadingUploads}
                ownerFilterLabel={null}
                ownerFilterValue={null}
                ownerFilterOptions={[]}
                onChangeOwnerFilter={undefined}
                onRefresh={() => void refreshUploads()}
                onSelectUpload={(uploadId) => {
                  setSelectedUploadId(uploadId)
                  setEventOffset(0)
                }}
                onPrevPage={() => setUploadListOffset(Math.max(0, uploadListOffset - UPLOAD_PAGE_SIZE))}
                onNextPage={() => setUploadListOffset(uploadListOffset + UPLOAD_PAGE_SIZE)}
                canGoPrev={uploadListOffset > 0}
                canGoNext={uploadListOffset + UPLOAD_PAGE_SIZE < uploadsTotal}
              />
            </>
          ) : (
            <>
              <UploadsPanel
                title="All uploads"
                uploads={uploads}
                uploadsTotal={uploadsTotal}
                currentPage={uploadCurrentPage}
                totalPages={uploadTotalPages}
                selectedUploadId={selectedUploadId}
                isLoadingUploads={isLoadingUploads}
                ownerFilterLabel="Owner"
                ownerFilterValue={uploadOwnerFilter}
                ownerFilterOptions={users}
                onChangeOwnerFilter={(userId) => setUploadOwnerFilter(userId)}
                onRefresh={() => void refreshUploads()}
                onSelectUpload={(uploadId) => {
                  setSelectedUploadId(uploadId)
                  setEventOffset(0)
                }}
                onPrevPage={() => setUploadListOffset(Math.max(0, uploadListOffset - UPLOAD_PAGE_SIZE))}
                onNextPage={() => setUploadListOffset(uploadListOffset + UPLOAD_PAGE_SIZE)}
                canGoPrev={uploadListOffset > 0}
                canGoNext={uploadListOffset + UPLOAD_PAGE_SIZE < uploadsTotal}
              />
              <UsersPanel
                users={filteredUsers}
                isLoadingUsers={isLoadingUsers}
                usersError={usersError}
                currentUserId={currentUser.id}
                searchValue={userSearch}
                onSearchChange={setUserSearch}
                onRefresh={() => void loadUsers()}
                onToggleAdmin={(userId, isAdmin) => void updateUserAdmin(userId, isAdmin)}
              />
            </>
          )}
        </section>

        <section className="right-column">
          <SummaryGrid selectedUpload={selectedUpload} />
          <EventsPanel
            eventsResponse={eventsResponse}
            eventsError={eventsError}
            isLoadingEvents={isLoadingEvents}
            currentPage={currentPage}
            totalPages={totalPages}
            offset={eventOffset}
            pageSize={EVENT_PAGE_SIZE}
            onPrevPage={() => setEventOffset(Math.max(0, eventOffset - EVENT_PAGE_SIZE))}
            onNextPage={() => setEventOffset(eventOffset + EVENT_PAGE_SIZE)}
          />
        </section>
      </main>
    </div>
  )
}

export default App
