import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const { signUp, session } = useAuth()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (session) {
      navigate('/tracker', { replace: true })
    }
  }, [session, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const data = await signUp(email, password)
      if (data.user?.identities?.length === 0) {
        setErrorMsg('An account with this email already exists.')
      } else {
        setSuccessMsg(
          'Registration successful! If Supabase email confirmation is enabled, please verify your email inbox.'
        )
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create account.')
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
            Create Account
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
            Join to access your protected <span style={{ color: 'var(--brand-green)' }}>Tracker</span>
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

        {/* Success notification */}
        {successMsg && (
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 8,
            fontSize: '0.85rem',
            background: 'rgba(62, 207, 142, 0.12)',
            border: '1px solid rgba(62, 207, 142, 0.35)',
            color: '#7ee787',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}>
            <span>✓</span>
            <span>{successMsg}</span>
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
            <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>
              Password (min. 6 characters)
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>
              Confirm Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: 6, fontSize: '0.95rem' }}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        {/* Switch to Login */}
        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center',
          fontSize: '0.88rem',
          color: 'var(--text-muted)'
        }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{ color: 'var(--brand-green)', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
