import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import UpdateToast from './components/UpdateToast'

// Code-split the heaviest route:
// Unauthenticated visitors loading /login or /signup do not pay the cost of downloading
// the habit CRUD engine, offline queueing, and avatar storage manager until after they authenticate.
const Tracker = lazy(() => import('./pages/Tracker'))

function RouteLoadingFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      background: 'var(--bg-primary)',
      color: 'var(--text-muted)'
    }}>
      <div style={{
        width: 36,
        height: 36,
        border: '3px solid rgba(62, 207, 142, 0.2)',
        borderTopColor: 'var(--brand-green)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '0.9rem', letterSpacing: '0.02em' }}>Loading tracker...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Protected Tracker Route (Lazy-loaded) */}
            <Route
              path="/tracker"
              element={
                <ProtectedRoute>
                  <Tracker />
                </ProtectedRoute>
              }
            />

            {/* Default Redirects */}
            <Route path="/" element={<Navigate to="/tracker" replace />} />
            <Route path="*" element={<Navigate to="/tracker" replace />} />
          </Routes>
        </Suspense>
        {/* Global PWA Service Worker Update & Offline Ready Toast */}
        <UpdateToast />
      </AuthProvider>
    </BrowserRouter>
  )
}
