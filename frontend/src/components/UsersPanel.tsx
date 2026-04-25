import type { UserRecord } from '../types'

type UsersPanelProps = {
  users: UserRecord[]
  isLoadingUsers: boolean
  usersError: string | null
  currentUserId: string
  searchValue: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onToggleAdmin: (userId: string, isAdmin: boolean) => void
}

export function UsersPanel({
  users,
  isLoadingUsers,
  usersError,
  currentUserId,
  searchValue,
  onSearchChange,
  onRefresh,
  onToggleAdmin,
}: UsersPanelProps) {
  return (
    <section className="panel users-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Admin</p>
          <h2>Users</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <label className="filter-field">
        <span>Filter users</span>
        <input
          type="search"
          placeholder="Search by username"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      {usersError ? <p className="error-text">{usersError}</p> : null}

      {isLoadingUsers ? (
        <p className="empty-state">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="empty-state">No matching users.</p>
      ) : (
        <div className="user-list">
          {users.map((user) => (
            <div key={user.id} className="user-row">
              <div>
                <strong>{user.username}</strong>
                <p>{user.id === currentUserId ? 'Current session' : 'User account'}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={user.isAdmin}
                  onChange={(event) => onToggleAdmin(user.id, event.target.checked)}
                />
                <span>Admin</span>
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
