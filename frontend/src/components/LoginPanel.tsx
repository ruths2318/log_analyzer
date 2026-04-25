type LoginPanelProps = {
  username: string
  password: string
  authError: string | null
  isSubmitting: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onLogin: () => void
  onRegister: () => void
}

export function LoginPanel({
  username,
  password,
  authError,
  isSubmitting,
  onUsernameChange,
  onPasswordChange,
  onLogin,
  onRegister,
}: LoginPanelProps) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">Access</p>
        <h1>Sign in</h1>
        <div className="login-form">
          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(event) => onUsernameChange(event.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>
          <div className="auth-actions">
            <button className="primary-button" type="button" disabled={isSubmitting} onClick={onLogin}>
              {isSubmitting ? 'Working...' : 'Sign in'}
            </button>
            <button className="ghost-button" type="button" disabled={isSubmitting} onClick={onRegister}>
              Create account
            </button>
          </div>
          {authError ? <p className="error-text">{authError}</p> : null}
        </div>
      </section>
    </main>
  )
}
