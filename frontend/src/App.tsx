import { startTransition, useDeferredValue, useEffect, useState } from 'react'

import './App.css'
import { ActivityTimeline } from './components/ActivityTimeline'
import { AnomaliesOverview } from './components/AnomaliesOverview'
import { FieldAtlasModal } from './components/FieldAtlasModal'
import { EventsPanel } from './components/EventsPanel'
import { EventInsights } from './components/EventInsights'
import { InsightsOverview } from './components/InsightsOverview'
import { LoginPanel } from './components/LoginPanel'
import { UploadPanel } from './components/UploadPanel'
import { UploadsPanel } from './components/UploadsPanel'
import { UsersPanel } from './components/UsersPanel'
import { WidgetFieldModal } from './components/WidgetFieldModal'
import { getFieldLabel, getRiskLabel, getStatusBand, matchesPivot, type PivotCondition, type PivotField } from './eventFields'
import { DEFAULT_EVENT_PAGE_SIZE, UPLOAD_PAGE_SIZE, useLogAnalyzerStore } from './store/useLogAnalyzerStore'
import type { LogEvent } from './types'

function matchesEvent(event: LogEvent, query: string) {
  if (!query) {
    return true
  }

  const haystack = [
    event.action,
    event.userName,
    event.clientIp,
    event.hostname,
    event.url,
    event.urlCategory,
    event.pageRisk,
    event.threatCategory,
    event.protocol,
    event.requestMethod,
    event.statusCode?.toString(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function getSortedOptions(values: string[], fallbackLabel: string) {
  return [fallbackLabel, ...values.filter((value) => value !== fallbackLabel).sort((left, right) => left.localeCompare(right))]
}

const EVENT_PAGE_SIZE_OPTIONS = [25, 50, 100, 500, 1000]
type InsightWidget = {
  id: string
  field: PivotField
  view: 'bars' | 'pie'
}

const DEFAULT_TABLE_FIELDS: PivotField[] = [
  'action',
  'userName',
  'clientIp',
  'requestMethod',
  'hostname',
  'urlCategory',
  'statusBand',
  'riskLabel',
]

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
  const eventPageSize = useLogAnalyzerStore((state) => state.eventPageSize)
  const username = useLogAnalyzerStore((state) => state.username)
  const password = useLogAnalyzerStore((state) => state.password)
  const setUsername = useLogAnalyzerStore((state) => state.setUsername)
  const setPassword = useLogAnalyzerStore((state) => state.setPassword)
  const setSelectedFile = useLogAnalyzerStore((state) => state.setSelectedFile)
  const setSelectedUploadId = useLogAnalyzerStore((state) => state.setSelectedUploadId)
  const setEventOffset = useLogAnalyzerStore((state) => state.setEventOffset)
  const setEventPageSize = useLogAnalyzerStore((state) => state.setEventPageSize)
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
  const [searchInput, setSearchInput] = useState('')
  const [actionFilter, setActionFilter] = useState('All actions')
  const [riskFilter, setRiskFilter] = useState('All risk levels')
  const [statusBandFilter, setStatusBandFilter] = useState('All status bands')
  const [pivots, setPivots] = useState<PivotCondition[]>([])
  const [insightWidgets, setInsightWidgets] = useState<InsightWidget[]>([
    { id: 'widget-user', field: 'userName', view: 'bars' },
    { id: 'widget-ip', field: 'clientIp', view: 'bars' },
    { id: 'widget-host', field: 'hostname', view: 'bars' },
  ])
  const [isUploadListExpanded, setIsUploadListExpanded] = useState(false)
  const [timeRangePivot, setTimeRangePivot] = useState<{ start: string; end: string } | null>(null)
  const [tableFields, setTableFields] = useState<PivotField[]>(DEFAULT_TABLE_FIELDS)
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false)
  const [isWidgetFieldModalOpen, setIsWidgetFieldModalOpen] = useState(false)

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
  }, [currentUser, eventOffset, eventPageSize, loadEvents, selectedUploadId])

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

  function resetWorkspaceFilters() {
    setSearchInput('')
    setActionFilter('All actions')
    setRiskFilter('All risk levels')
    setStatusBandFilter('All status bands')
    setPivots([])
    setInsightWidgets([
      { id: 'widget-user', field: 'userName', view: 'bars' },
      { id: 'widget-ip', field: 'clientIp', view: 'bars' },
      { id: 'widget-host', field: 'hostname', view: 'bars' },
    ])
    setIsInsightsModalOpen(false)
    setIsWidgetFieldModalOpen(false)
    setTimeRangePivot(null)
    setTableFields(DEFAULT_TABLE_FIELDS)
  }

  function addPivot(field: PivotField, value: string) {
    setPivots((current) => {
      if (current.some((pivot) => pivot.field === field && pivot.value === value)) {
        return current
      }
      return [...current, { field, value }]
    })
  }

  function removePivot(field: PivotField, value: string) {
    setPivots((current) => current.filter((pivot) => !(pivot.field === field && pivot.value === value)))
  }

  function updateInsightWidgetField(widgetId: string, field: PivotField) {
    setInsightWidgets((current) => current.map((widget) => (widget.id === widgetId ? { ...widget, field } : widget)))
  }

  function addInsightWidget(field: PivotField) {
    setInsightWidgets((current) => [...current, { id: `${field}-${Date.now()}`, field, view: 'bars' }])
  }

  function updateInsightWidgetView(widgetId: string, view: 'bars' | 'pie') {
    setInsightWidgets((current) => current.map((widget) => (widget.id === widgetId ? { ...widget, view } : widget)))
  }

  function removeInsightWidget(widgetId: string) {
    setInsightWidgets((current) => (current.length > 1 ? current.filter((widget) => widget.id !== widgetId) : current))
  }

  function addTableField(field: PivotField) {
    setTableFields((current) => (current.includes(field) ? current : [...current, field]))
  }

  const searchQuery = useDeferredValue(searchInput.trim().toLowerCase())

  const selectedUpload = uploads.find((upload) => upload.id === selectedUploadId) ?? eventsResponse?.upload ?? null
  const totalPages = eventsResponse ? Math.max(1, Math.ceil(eventsResponse.pagination.total / eventPageSize)) : 1
  const currentPage = Math.floor(eventOffset / eventPageSize) + 1
  const uploadTotalPages = Math.max(1, Math.ceil(uploadsTotal / UPLOAD_PAGE_SIZE))
  const uploadCurrentPage = Math.floor(uploadListOffset / UPLOAD_PAGE_SIZE) + 1
  const filteredUsers = users.filter((user) => user.username.toLowerCase().includes(userSearch.trim().toLowerCase()))
  const visibleEvents = eventsResponse?.events ?? []
  const actionOptions = getSortedOptions([...new Set(visibleEvents.map((event) => event.action).filter(Boolean))], 'All actions')
  const riskOptions = getSortedOptions(
    [...new Set(visibleEvents.map((event) => getRiskLabel(event)).filter(Boolean))],
    'All risk levels',
  )
  const statusBandOptions = getSortedOptions(
    [...new Set(visibleEvents.map((event) => getStatusBand(event.statusCode)).filter(Boolean))],
    'All status bands',
  )
  const baseFilteredEvents = visibleEvents.filter((event) => {
    if (!matchesEvent(event, searchQuery)) {
      return false
    }
    if (actionFilter !== 'All actions' && event.action !== actionFilter) {
      return false
    }
    if (riskFilter !== 'All risk levels' && getRiskLabel(event) !== riskFilter) {
      return false
    }
    if (statusBandFilter !== 'All status bands' && getStatusBand(event.statusCode) !== statusBandFilter) {
      return false
    }
    if (!pivots.every((pivot) => matchesPivot(event, pivot))) {
      return false
    }
    return true
  })
  const filteredEvents = baseFilteredEvents.filter((event) => {
    if (timeRangePivot) {
      const eventTime = new Date(event.eventTime).getTime()
      const pivotStart = new Date(timeRangePivot.start).getTime()
      const pivotEnd = new Date(timeRangePivot.end).getTime()
      if (eventTime < pivotStart || eventTime >= pivotEnd) {
        return false
      }
    }
    return true
  })

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
          <span className="overflow-slider">{currentUser.username}{currentUser.isAdmin ? ' · admin' : ''}</span>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className={`layout ${!isUploadListExpanded ? 'is-rail-collapsed' : ''}`}>
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
                  resetWorkspaceFilters()
                  setSelectedUploadId(uploadId)
                  setEventOffset(0)
                }}
                onPrevPage={() => setUploadListOffset(Math.max(0, uploadListOffset - UPLOAD_PAGE_SIZE))}
                onNextPage={() => setUploadListOffset(uploadListOffset + UPLOAD_PAGE_SIZE)}
                canGoPrev={uploadListOffset > 0}
                canGoNext={uploadListOffset + UPLOAD_PAGE_SIZE < uploadsTotal}
                isCollapsed={!isUploadListExpanded}
                onToggleCollapsed={() => setIsUploadListExpanded((value) => !value)}
                collapsedSummary={`${uploadsTotal} files available${selectedUpload ? ` · selected ${selectedUpload.originalFilename}` : ''}.`}
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
                  resetWorkspaceFilters()
                  setSelectedUploadId(uploadId)
                  setEventOffset(0)
                }}
                onPrevPage={() => setUploadListOffset(Math.max(0, uploadListOffset - UPLOAD_PAGE_SIZE))}
                onNextPage={() => setUploadListOffset(uploadListOffset + UPLOAD_PAGE_SIZE)}
                canGoPrev={uploadListOffset > 0}
                canGoNext={uploadListOffset + UPLOAD_PAGE_SIZE < uploadsTotal}
                isCollapsed={!isUploadListExpanded}
                onToggleCollapsed={() => setIsUploadListExpanded((value) => !value)}
                collapsedSummary={`${uploadsTotal} files available${selectedUpload ? ` · selected ${selectedUpload.originalFilename}` : ''}.`}
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
          <section className="hero-panel workbench-strip">
            <div className="workbench-strip-item">
              <span className="metric-label">Dataset</span>
              <strong>{selectedUpload?.originalFilename ?? 'No upload selected'}</strong>
            </div>
            <div className="workbench-strip-item workbench-strip-item-wide">
              <span className="metric-label">Active pivots</span>
              {pivots.length === 0 && !timeRangePivot ? (
                <strong>None</strong>
              ) : (
                <div className="workbench-pivots">
                  {pivots.map((pivot) => (
                    <div
                      key={`strip-${pivot.field}-${pivot.value}`}
                      className="pivot-pill"
                    >
                      <span>{getFieldLabel(pivot.field)}</span>
                      <strong>{pivot.value}</strong>
                      <button
                        className="pivot-remove-button"
                        type="button"
                        aria-label={`Remove ${getFieldLabel(pivot.field)} pivot`}
                        onClick={() => removePivot(pivot.field, pivot.value)}
                      >
                        x
                      </button>
                    </div>
                  ))}
                  {timeRangePivot ? (
                    <div className="pivot-pill">
                      <span>Time</span>
                      <strong>{new Date(timeRangePivot.start).toLocaleString()}</strong>
                      <button
                        className="pivot-remove-button"
                        type="button"
                        aria-label="Remove time pivot"
                        onClick={() => setTimeRangePivot(null)}
                      >
                        x
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <InsightsOverview
            key={selectedUploadId ?? 'no-upload'}
            uploadId={selectedUploadId}
            onOpenInsightsModal={() => setIsInsightsModalOpen(true)}
            onAddPivot={addPivot}
            onAddTimePivot={(start, end) => setTimeRangePivot({ start, end })}
          />
          <AnomaliesOverview
            key={`anomalies-${selectedUploadId ?? 'no-upload'}`}
            uploadId={selectedUploadId}
            onAddPivot={addPivot}
            onAddTimePivot={(start, end) => setTimeRangePivot({ start, end })}
          />

          <section className="panel control-panel">
            <div className="panel-header compact-header">
              <div>
                <p className="section-label">Filters</p>
                <h2>Filter current page</h2>
              </div>
            </div>
            <div className="filter-toolbar">
              <label className="filter-field">
                <span>Search event context</span>
                <input
                  type="search"
                  placeholder="IP, user, host, category, URL"
                  value={searchInput}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    startTransition(() => setSearchInput(nextValue))
                  }}
                />
              </label>
              <label className="filter-field">
                <span>Action</span>
                <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                  {actionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Risk signal</span>
                <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                  {riskOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Status band</span>
                <select value={statusBandFilter} onChange={(event) => setStatusBandFilter(event.target.value)}>
                  {statusBandOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <div className="analytics-grid">
            <ActivityTimeline
              events={baseFilteredEvents}
              selectedBucketStart={timeRangePivot?.start ?? null}
              onBucketSelect={setTimeRangePivot}
            />
            <EventInsights
              events={filteredEvents}
              widgets={insightWidgets}
              pivots={pivots}
              onOpenFieldAtlas={() => setIsWidgetFieldModalOpen(true)}
              onFieldChange={updateInsightWidgetField}
              onViewChange={updateInsightWidgetView}
              onRemoveWidget={removeInsightWidget}
              onAddWidget={addInsightWidget}
              onAddPivot={addPivot}
              onRemovePivot={removePivot}
            />
          </div>

          <EventsPanel
            eventsResponse={eventsResponse}
            filteredEvents={filteredEvents}
            eventsError={eventsError}
            isLoadingEvents={isLoadingEvents}
            currentPage={currentPage}
            totalPages={totalPages}
            offset={eventOffset}
            pageSize={eventPageSize}
            pageSizeOptions={EVENT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(pageSize) =>
              setEventPageSize(
                EVENT_PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_EVENT_PAGE_SIZE,
              )
            }
            pivots={pivots}
            timeRangePivot={timeRangePivot}
            tableFields={tableFields}
            onAddPivot={addPivot}
            onRemovePivot={removePivot}
            onAddWidget={addInsightWidget}
            onAddTableField={addTableField}
            onClearTimePivot={() => setTimeRangePivot(null)}
            onClearPivots={() => {
              setPivots([])
              setTimeRangePivot(null)
            }}
            onPrevPage={() => setEventOffset(Math.max(0, eventOffset - eventPageSize))}
            onNextPage={() => setEventOffset(eventOffset + eventPageSize)}
          />
        </section>
      </main>
      {isInsightsModalOpen ? (
        <FieldAtlasModal
          key={selectedUploadId ?? 'no-upload'}
          uploadId={selectedUploadId}
          onClose={() => setIsInsightsModalOpen(false)}
          onAddPivot={addPivot}
          onAddTimePivot={(start, end) => setTimeRangePivot({ start, end })}
        />
      ) : null}
      {isWidgetFieldModalOpen ? (
        <WidgetFieldModal
          key={`widget-${selectedUploadId ?? 'no-upload'}`}
          uploadId={selectedUploadId}
          pivots={pivots}
          onClose={() => setIsWidgetFieldModalOpen(false)}
          onAddWidget={addInsightWidget}
          onAddPivot={addPivot}
          onRemovePivot={removePivot}
        />
      ) : null}
    </div>
  )
}

export default App
