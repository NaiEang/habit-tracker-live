import React, { useState, useEffect } from 'react'

/**
 * OfflineBanner Component
 * Hand-written component driven by window 'online' and 'offline' events.
 * Alerts the user immediately when the train enters a tunnel or WiFi drops,
 * reassuring them that habits can still be added and will sync upon reconnection.
 */
export default function OfflineBanner({ queuedCount = 0 }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
      }, 4000)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOffline(true)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline && !showReconnected) {
    return null
  }

  if (showReconnected) {
    return (
      <aside
        aria-label="Network status notification"
        role="status"
        style={{
          background: 'rgba(62, 207, 142, 0.15)',
          borderBottom: '1px solid var(--brand-green)',
          color: 'var(--brand-green)',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '0.86rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          animation: 'fadeIn 0.3s ease-in'
        }}
      >
        <span>📶</span>
        <span>Back online! Synchronizing queued data with Supabase...</span>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Offline status notification"
      role="alert"
      style={{
        background: 'rgba(227, 179, 65, 0.15)',
        borderBottom: '1px solid rgba(227, 179, 65, 0.4)',
        color: '#e3b341',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: '0.86rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }}
    >
      <span>⚠️</span>
      <span>
        You are currently offline. New habits will be queued locally and synced automatically when you reconnect.
      </span>
      {queuedCount > 0 && (
        <span style={{
          background: 'rgba(227, 179, 65, 0.25)',
          padding: '2px 8px',
          borderRadius: 12,
          fontSize: '0.78rem'
        }}>
          {queuedCount} queued
        </span>
      )}
    </aside>
  )
}
