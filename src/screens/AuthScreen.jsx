import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setConfirmSent(false)
    setLoading(true)
    try {
      const { error: authError, data } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password)
      if (authError) throw authError
      if (isSignUp && data?.user && !data?.session) {
        setConfirmSent(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-3">
          <img src="/cadence-logo.svg" alt="Cadence" className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold text-center text-text mb-0.5 tracking-tight">Cadence</h1>
        <p className="text-xs text-muted text-center mb-8 uppercase tracking-widest">Train Smarter</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-border bg-card text-text text-base focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-border bg-card text-text text-base focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {confirmSent && (
            <div className="bg-success/10 border border-success/20 rounded-lg px-3 py-3 text-center">
              <p className="text-sm font-medium text-success">Check your email</p>
              <p className="text-xs text-text-secondary mt-1">We sent a confirmation link to <strong className="text-text">{email}</strong></p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-bg font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="text-sm text-center text-muted mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setConfirmSent(false) }}
            className="text-primary font-medium"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
