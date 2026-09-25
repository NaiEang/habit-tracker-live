import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * UpdateToast Component
 * Uses vite-plugin-pwa's useRegisterSW hook with registerType: 'prompt'.
 * Displays a prompt when a new service worker version is waiting to activate,
 * allowing the user to refresh and activate the new build immediately.
 */
export default function UpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('[PWA] Service Worker registered at:', swUrl)
      if (r) {
        // Periodically check for SW updates every hour
        setInterval(() => {
          r.update().catch(err => console.error('[PWA] SW periodic check error:', err))
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration failed:', error)
    }
  })

  const closeOfflineReady = () => setOfflineReady(false)
  const closeNeedRefresh = () => setNeedRefresh(false)

  if (!offlineReady && !needRefresh) {
    return null
  }

  return (
    <aside
      aria-label="Application update notifications"
      role="region"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 9999,
        maxWidth: 380,
        width: 'calc(100vw - 40px)',
        padding: '16px 20px',
        background: 'rgba(22, 27, 34, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: needRefresh ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
        borderRadius: 14,
        boxShadow: needRefresh ? '0 12px 36px rgba(62, 207, 142, 0.25)' : '0 10px 30px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: '1.4rem' }}>{needRefresh ? '🚀' : '📶'}</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {needRefresh ? 'New version available' : 'Ready to work offline'}
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {needRefresh
              ? 'A fresh update is ready. Click Refresh to activate the latest features.'
              : 'App shell and assets cached. You can now use this habit tracker without an internet connection.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {needRefresh ? (
          <>
            <button
              onClick={() => updateServiceWorker(true)}
              className="btn btn-primary"
              style={{ padding: '6px 16px', fontSize: '0.82rem' }}
            >
              ↻ Refresh
            </button>
            <button
              onClick={closeNeedRefresh}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
            >
              Later
            </button>
          </>
        ) : (
          <button
            onClick={closeOfflineReady}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            Dismiss
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </aside>
  )
}
