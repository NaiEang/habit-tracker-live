import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/tracker'

  // If already logged in, redirect
  React.useEffect(() => {
    if (session) {
      navigate(from, { replace: true })
    }
  }, [session, navigate, from])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setErrorMsg(err.message || 'Failed to sign in. Please verify your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: 440, padding: '36px 32px' }}>
        {/* Supabase Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 50,
            height: 50,
            margin: '0 auto 16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #3ecf8e 0%, #1c7c54 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(62, 207, 142, 0.4)'
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12.5 2L3 14H11.5L10.5 22L21 9H12.5L12.5 2Z" fill="#0d1117" stroke="#0d1117" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Welcome Back
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
            Sign in to access your protected <span style={{ color: 'var(--brand-green)' }}>Tracker</span>
          </p>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 8,
            fontSize: '0.85rem',
            background: 'rgba(248, 81, 73, 0.12)',
            border: '1px solid rgba(248, 81, 73, 0.35)',
            color: '#ff7b72',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              autoComplete="email"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                Password
              </label>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: 6, fontSize: '0.95rem' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Switch to SignUp */}
        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center',
          fontSize: '0.88rem',
          color: 'var(--text-muted)'
        }}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{ color: 'var(--brand-green)', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}
