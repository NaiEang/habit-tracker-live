import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import ErrorBoundary from '../components/ErrorBoundary'
import AvatarUpload from '../components/AvatarUpload'
import OfflineBanner from '../components/OfflineBanner'

// Component to simulate an isolated crash when testing the ErrorBoundary
function CrashSimulator({ active }) {
  if (active) {
    throw new Error('Simulated runtime error: The ErrorBoundary caught this crash, keeping the rest of the page alive!')
  }
  return null
}

export default function Tracker() {
  const { user, session, signOut } = useAuth()

  // Real Supabase state (starts EMPTY by default)
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [syncMessage, setSyncMessage] = useState(null)

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('Dev')
  const [newPriority, setNewPriority] = useState('Medium')
  const [submitting, setSubmitting] = useState(false)

  // Offline queue state
  const [queuedHabits, setQueuedHabits] = useState([])

  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('General')
  const [editPriority, setEditPriority] = useState('Medium')
  const [savingEdit, setSavingEdit] = useState(false)

  // Deleting and updating state indicators
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  // Filter & UI state
  const [filter, setFilter] = useState('all') // 'all' | 'active' | 'completed'
  const [signingOut, setSigningOut] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [showSessionDetails, setShowSessionDetails] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  // ErrorBoundary test crash trigger state
  const [simulateCrash, setSimulateCrash] = useState(false)

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.deferredPWAInstallPrompt || null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
    }

    // Check if early capture in index.html already caught it
    if (window.deferredPWAInstallPrompt) {
      setDeferredPrompt(window.deferredPWAInstallPrompt)
    }

    const handleCanInstall = () => {
      setDeferredPrompt(window.deferredPWAInstallPrompt)
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault()
      window.deferredPWAInstallPrompt = e
      setDeferredPrompt(e)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      window.deferredPWAInstallPrompt = null
    }

    window.addEventListener('pwa-can-install', handleCanInstall)
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('pwa-can-install', handleCanInstall)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    const promptEvent = deferredPrompt || window.deferredPWAInstallPrompt
    if (promptEvent) {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
      window.deferredPWAInstallPrompt = null
    } else {
      alert(
        'PWA Install Tip:\n\n1. In Chrome/Edge: Look at the far right of your address/URL bar for the Install icon (⊕ or a monitor with arrow).\n2. DevTools Instant Trigger: Press F12 > "Application" tab > "Manifest" on left > Click "Install" at the top!'
      )
    }
  }

  const queueStorageKey = user?.id ? `offline_habits_queue_${user.id}` : null

  // ==========================================
  // OFFLINE QUEUE SYNC ENGINE
  // ==========================================
  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine || !user?.id || !queueStorageKey) return

    try {
      const rawQueue = localStorage.getItem(queueStorageKey)
      if (!rawQueue) return

      const queue = JSON.parse(rawQueue)
      if (!Array.isArray(queue) || queue.length === 0) return

      console.log(`[Offline Sync] Attempting to sync ${queue.length} habits to Supabase...`)

      // Format payload for batch insert
      const habitsToInsert = queue.map(item => ({
        title: item.title,
        category: item.category,
        priority: item.priority,
        completed: false,
        user_id: user.id
      }))

      let { data, error: syncErr } = await supabase
        .from('habits')
        .insert(habitsToInsert)
        .select()

      // Fallback if schema uses 'name' column
      if (syncErr && syncErr.message?.includes('title')) {
        const fallbackPayload = queue.map(item => ({
          name: item.title,
          category: item.category,
          priority: item.priority,
          completed: false,
          user_id: user.id
        }))
        const fallbackRes = await supabase.from('habits').insert(fallbackPayload).select()
        data = fallbackRes.data
        syncErr = fallbackRes.error
      }

      if (syncErr) {
        throw syncErr
      }

      // Clear local storage queue upon successful sync
      localStorage.removeItem(queueStorageKey)
      setQueuedHabits([])

      // Merge and refresh list
      if (data) {
        setSyncMessage(`✓ Successfully synced ${data.length} offline ${data.length === 1 ? 'habit' : 'habits'} to Supabase!`)
        setTimeout(() => setSyncMessage(null), 4000)
        fetchHabits()
      }
    } catch (err) {
      console.warn('[Offline Sync] Sync failed (will retry on next reconnection):', err)
    }
  }, [user?.id, queueStorageKey])

  // Listen to network reconnection events to trigger automatic sync
  useEffect(() => {
    const handleReconnected = () => {
      console.log('[Network] Reconnected to internet. Triggering auto-sync...')
      syncOfflineQueue()
    }

    window.addEventListener('online', handleReconnected)

    // Load initial queue from localStorage
    if (queueStorageKey) {
      try {
        const savedQueue = localStorage.getItem(queueStorageKey)
        if (savedQueue) {
          const parsed = JSON.parse(savedQueue)
          if (Array.isArray(parsed)) {
            setQueuedHabits(parsed)
            // If we are currently online, sync them right now
            if (navigator.onLine && parsed.length > 0) {
              syncOfflineQueue()
            }
          }
        }
      } catch {
        // ignore parse error
      }
    }

    return () => {
      window.removeEventListener('online', handleReconnected)
    }
  }, [queueStorageKey, syncOfflineQueue])

  // ==========================================
  // 1. READ / LIST (Scoped to auth.uid() by RLS)
  // ==========================================
  const fetchHabits = async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchErr } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchErr) {
        throw fetchErr
      }

      setHabits(data || [])
    } catch (err) {
      console.error('Error fetching habits from Supabase:', err)
      // If offline, don't crash with alarming error; user can still see cached UI
      if (!navigator.onLine) {
        setError('Operating in offline mode. Displaying locally cached habits.')
      } else {
        setError(err.message || 'Failed to fetch habits from database.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHabits()
  }, [user?.id])

  // ==========================================
  // 2. CREATE / INSERT (With Offline Queueing)
  // ==========================================
  const handleAddHabit = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || submitting || !user?.id) return

    setSubmitting(true)
    setActionError(null)

    const titleText = newTitle.trim()

    // OFFLINE GUARD: If offline, queue locally immediately
    if (!navigator.onLine) {
      const offlineItem = {
        id: `offline-${Date.now()}`,
        title: titleText,
        category: newCategory,
        priority: newPriority,
        completed: false,
        created_at: new Date().toISOString(),
        isQueued: true
      }

      const updatedQueue = [offlineItem, ...queuedHabits]
      setQueuedHabits(updatedQueue)
      if (queueStorageKey) {
        localStorage.setItem(queueStorageKey, JSON.stringify(updatedQueue))
      }

      setHabits([offlineItem, ...habits])
      setNewTitle('')
      setSubmitting(false)
      setSyncMessage('⚠️ Offline: Habit added to local queue. Will sync automatically upon reconnecting!')
      setTimeout(() => setSyncMessage(null), 4500)
      return
    }

    try {
      let payload = {
        title: titleText,
        category: newCategory,
        priority: newPriority,
        completed: false,
        user_id: user.id
      }

      let { data, error: insertErr } = await supabase
        .from('habits')
        .insert([payload])
        .select()

      // Fallback if table uses 'name' instead of 'title'
      if (insertErr && insertErr.message?.includes('title')) {
        const fallbackPayload = {
          name: titleText,
          category: newCategory,
          priority: newPriority,
          completed: false,
          user_id: user.id
        }
        const fallbackRes = await supabase
          .from('habits')
          .insert([fallbackPayload])
          .select()

        data = fallbackRes.data
        insertErr = fallbackRes.error
      }

      if (insertErr) {
        throw insertErr
      }

      if (data && data[0]) {
        try {
          await supabase.from('daily_logs').insert([{
            habit_id: data[0].id,
            user_id: user.id,
            completed: false
          }])
        } catch {
          // non-blocking if daily_logs table isn't created yet
        }

        setHabits([data[0], ...habits])
        setNewTitle('')
      }
    } catch (err) {
      console.error('Error adding habit:', err)
      // If network failed midway, queue offline as safety net
      if (!navigator.onLine || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        const offlineItem = {
          id: `offline-${Date.now()}`,
          title: titleText,
          category: newCategory,
          priority: newPriority,
          completed: false,
          created_at: new Date().toISOString(),
          isQueued: true
        }
        const updatedQueue = [offlineItem, ...queuedHabits]
        setQueuedHabits(updatedQueue)
        if (queueStorageKey) {
          localStorage.setItem(queueStorageKey, JSON.stringify(updatedQueue))
        }
        setHabits([offlineItem, ...habits])
        setNewTitle('')
        setSyncMessage('⚠️ Connection lost: Habit queued locally for sync.')
        setTimeout(() => setSyncMessage(null), 4000)
      } else {
        setActionError(`Failed to add habit: ${err.message}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ==========================================
  // 3. TOGGLE COMPLETED & LOG
  // ==========================================
  const toggleHabit = async (habit) => {
    if (!habit?.id || togglingId) return

    setTogglingId(habit.id)
    setActionError(null)

    const nextCompleted = !habit.completed

    // Optimistic UI update
    setHabits(habits.map(h => h.id === habit.id ? { ...h, completed: nextCompleted } : h))

    // If offline item, update locally only
    if (habit.isQueued) {
      setTogglingId(null)
      return
    }

    try {
      const { error: updateErr } = await supabase
        .from('habits')
        .update({ completed: nextCompleted })
        .eq('id', habit.id)

      if (updateErr) {
        throw updateErr
      }

      try {
        await supabase.from('daily_logs').insert([{
          habit_id: habit.id,
          user_id: user.id,
          completed: nextCompleted
        }])
      } catch {
        // ignore if daily_logs table is optional
      }
    } catch (err) {
      console.error('Error updating habit:', err)
      setActionError(`Failed to update habit: ${err.message}`)
      setHabits(habits.map(h => h.id === habit.id ? { ...h, completed: habit.completed } : h))
    } finally {
      setTogglingId(null)
    }
  }

  // ==========================================
  // 4. EDIT / UPDATE
  // ==========================================
  const startEditing = (habit) => {
    setEditingId(habit.id)
    setEditTitle(habit.title || habit.name || '')
    setEditCategory(habit.category || 'General')
    setEditPriority(habit.priority || 'Medium')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const saveEdit = async (id) => {
    if (!editTitle.trim() || savingEdit) return
    setSavingEdit(true)
    setActionError(null)

    try {
      const updateData = {
        title: editTitle.trim(),
        category: editCategory,
        priority: editPriority
      }

      let { error: updateErr } = await supabase
        .from('habits')
        .update(updateData)
        .eq('id', id)

      if (updateErr && updateErr.message?.includes('title')) {
        const fallbackRes = await supabase
          .from('habits')
          .update({
            name: editTitle.trim(),
            category: editCategory,
            priority: editPriority
          })
          .eq('id', id)
        updateErr = fallbackRes.error
      }

      if (updateErr) {
        throw updateErr
      }

      setHabits(habits.map(h => {
        if (h.id === id) {
          return {
            ...h,
            title: editTitle.trim(),
            name: editTitle.trim(),
            category: editCategory,
            priority: editPriority
          }
        }
        return h
      }))
      setEditingId(null)
    } catch (err) {
      console.error('Error editing habit:', err)
      setActionError(`Failed to save changes: ${err.message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  // ==========================================
  // 5. DELETE
  // ==========================================
  const deleteHabit = async (id) => {
    if (!id || deletingId) return
    setDeletingId(id)
    setActionError(null)

    // If it's a locally queued habit, remove from local storage
    if (typeof id === 'string' && id.startsWith('offline-')) {
      const updatedQueue = queuedHabits.filter(h => h.id !== id)
      setQueuedHabits(updatedQueue)
      if (queueStorageKey) {
        localStorage.setItem(queueStorageKey, JSON.stringify(updatedQueue))
      }
      setHabits(habits.filter(h => h.id !== id))
      setDeletingId(null)
      return
    }

    try {
      const { error: deleteErr } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)

      if (deleteErr) {
        throw deleteErr
      }

      setHabits(habits.filter(h => h.id !== id))
    } catch (err) {
      console.error('Error deleting habit:', err)
      setActionError(`Failed to delete habit: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // ==========================================
  // SHARE BUTTON WITH CLIPBOARD FALLBACK
  // ==========================================
  const handleShare = async () => {
    const shareData = {
      title: 'Habit Tracker - Resilient Offline PWA',
      text: `Tracking ${total} habits with a ${completionRate}% completion rate!`,
      url: window.location.href
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err)
        }
      }
    } else {
      // Clipboard fallback
      try {
        await navigator.clipboard.writeText(window.location.href)
        setCopiedShare(true)
        setTimeout(() => setCopiedShare(false), 2500)
      } catch {
        alert('Share URL: ' + window.location.href)
      }
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (err) {
      console.error('Error signing out:', err)
      setSigningOut(false)
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
  }

  // Stats calculation
  const total = habits.length
  const completedCount = habits.filter(i => i.completed).length
  const activeCount = total - completedCount
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const filteredHabits = habits.filter(item => {
    if (filter === 'active') return !item.completed
    if (filter === 'completed') return item.completed
    return true
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Offline Banner driven by network state */}
      <OfflineBanner queuedCount={queuedHabits.length} />

      {/* Main Container: Mobile-first padding, zero horizontal scroll */}
      <main style={{
        maxWidth: 1040,
        width: '100%',
        margin: '0 auto',
        padding: '24px 16px',
        boxSizing: 'border-box',
        flex: 1
      }}>
        {/* ============================================================ */}
        {/* SECTION 1: HEADER & PROFILE (WRAPPED IN ERRORBOUNDARY)       */}
        {/* ============================================================ */}
        <ErrorBoundary sectionName="Header & Profile Navigation">
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            paddingBottom: 20,
            marginBottom: 24,
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #3ecf8e 0%, #1c7c54 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 0 18px rgba(62, 207, 142, 0.35)'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 11L12 14L22 4" stroke="#0d1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" stroke="#0d1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
                  Habit <span style={{ color: 'var(--brand-green)' }}>Tracker</span>
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Offline PWA &bull; Multi-Tenant RLS &bull; Safe Storage
                </p>
              </div>
            </div>

            {/* Header Action Buttons & User Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="glass-panel" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 20,
                background: 'rgba(22, 27, 34, 0.85)',
                maxWidth: '100%'
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#3ecf8e',
                  boxShadow: '0 0 8px #3ecf8e',
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 160
                }}>
                  {user?.email}
                </span>
              </div>

              {/* Install App Button */}
              {!isInstalled && (
                <button
                  onClick={handleInstallApp}
                  className="btn btn-primary"
                  style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                  aria-label="Install Habit Tracker as PWA"
                  title="Install on your device"
                >
                  📲 Install App
                </button>
              )}

              {/* Share Button with Fallback */}
              <button
                onClick={handleShare}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                aria-label="Share Habit Tracker app"
                title="Share this app"
              >
                {copiedShare ? '✓ Copied!' : '🔗 Share'}
              </button>

              <button
                onClick={fetchHabits}
                disabled={loading}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                aria-label="Refresh habits from database"
                title="Refresh from Supabase"
              >
                {loading ? '⟳' : '⟳ Refresh'}
              </button>

              <button
                onClick={() => setShowSessionDetails(!showSessionDetails)}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                aria-label="Toggle Supabase Auth session details"
              >
                {showSessionDetails ? 'Hide' : 'Session'}
              </button>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: 'rgba(248, 81, 73, 0.4)', color: '#ff7b72' }}
                aria-label="Sign out of account"
              >
                {signingOut ? '...' : 'Sign Out'}
              </button>
            </div>
          </header>

          {/* Session Details Drawer */}
          {showSessionDetails && (
            <section className="glass-panel" style={{ padding: 20, marginBottom: 24, borderColor: 'rgba(62, 207, 142, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: '0.98rem', color: 'var(--brand-green)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <span>🔐</span> Active Supabase Auth Session
                </h3>
                <button
                  onClick={() => handleCopy(session?.access_token || '')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '5px 10px' }}
                  aria-label="Copy access token"
                >
                  {copiedToken ? '✓ Copied Token' : 'Copy Token'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User UUID</span>
                  <div className="code-block" style={{ marginTop: 4, padding: '6px 8px', fontSize: '0.75rem', overflowX: 'auto' }}>
                    {user?.id}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Storage RLS Scope</span>
                  <div className="code-block" style={{ marginTop: 4, padding: '6px 8px', fontSize: '0.75rem', color: 'var(--brand-green)' }}>
                    avatars/{user?.id?.slice(0, 8)}.../*
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Avatar Upload Component */}
          <section style={{ marginBottom: 24 }}>
            <AvatarUpload user={user} />
          </section>
        </ErrorBoundary>

        {/* Sync Success Notification */}
        {syncMessage && (
          <aside
            aria-label="Synchronization status"
            role="status"
            style={{
              padding: '10px 16px',
              background: 'rgba(62, 207, 142, 0.12)',
              border: '1px solid var(--brand-green)',
              borderRadius: 10,
              color: 'var(--brand-green)',
              marginBottom: 20,
              fontSize: '0.86rem',
              fontWeight: 600
            }}
          >
            {syncMessage}
          </aside>
        )}

        {/* Action Error Banner */}
        {actionError && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(248, 81, 73, 0.15)',
            border: '1px solid rgba(248, 81, 73, 0.4)',
            borderRadius: 10,
            color: '#ff7b72',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem'
          }}>
            <span>⚠️ {actionError}</span>
            <button
              onClick={() => setActionError(null)}
              style={{ background: 'transparent', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '1rem', padding: 4 }}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Query Error Banner */}
        {error && (
          <div style={{
            padding: '14px 18px',
            background: 'rgba(248, 81, 73, 0.15)',
            border: '1px solid rgba(248, 81, 73, 0.4)',
            borderRadius: 12,
            color: '#ff7b72',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ fontSize: '0.86rem' }}>
              <strong>Notice:</strong> {error}
            </div>
            <button onClick={fetchHabits} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} aria-label="Retry query">
              Retry Query
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 2: STATS SECTION (WRAPPED IN ERRORBOUNDARY + SIMULATOR) */}
        {/* ============================================================ */}
        <ErrorBoundary
          sectionName="Statistics Dashboard"
          onReset={() => setSimulateCrash(false)}
        >
          <CrashSimulator active={simulateCrash} />
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-sub)', margin: 0 }}>
                Overview & Analytics
              </h2>
              {/* Test Button for ErrorBoundary deliverable screenshot */}
              <button
                onClick={() => setSimulateCrash(true)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.72rem',
                  padding: '4px 10px',
                  borderColor: 'rgba(248, 81, 73, 0.35)',
                  color: '#ff7b72'
                }}
                aria-label="Simulate ErrorBoundary component crash"
                title="Deliberately crashes this section to prove ErrorBoundary keeps the rest of the app alive"
              >
                💥 Test Error Boundary
              </button>
            </div>

            {/* Mobile-first Responsive Grid: 1 col on mobile, 2 on sm, 4 on lg */}
            <div className="grid-responsive">
              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Habits
                </span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: 4 }}>
                  {total}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Completed
                </span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-green)', marginTop: 4 }}>
                  {completedCount}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Remaining
                </span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: 4 }}>
                  {activeCount}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Completion Rate
                </span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-purple)', marginTop: 4 }}>
                  {completionRate}%
                </div>
              </div>
            </div>
          </section>
        </ErrorBoundary>

        {/* ============================================================ */}
        {/* SECTION 3: ADD HABIT FORM (WRAPPED IN ERRORBOUNDARY)         */}
        {/* ============================================================ */}
        <ErrorBoundary sectionName="Habit Creator Form">
          <section className="glass-panel" style={{ padding: '20px', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 14, fontWeight: 700 }}>
              Add New Habit
            </h2>
            <form onSubmit={handleAddHabit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                required
                placeholder="e.g. Read 20 pages or Drink 2L water"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={submitting}
                className="input-field"
                aria-label="Habit title"
                style={{ flex: '1 1 200px', minWidth: 0 }}
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                disabled={submitting}
                className="input-field"
                aria-label="Habit category"
                style={{ flex: '0 1 120px', cursor: 'pointer', minWidth: 100 }}
              >
                <option value="Dev">Dev</option>
                <option value="Health">Health</option>
                <option value="Productivity">Productivity</option>
                <option value="Learning">Learning</option>
                <option value="General">General</option>
              </select>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                disabled={submitting}
                className="input-field"
                aria-label="Habit priority"
                style={{ flex: '0 1 110px', cursor: 'pointer', minWidth: 95 }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <button
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="btn btn-primary"
                style={{ padding: '10px 20px', opacity: submitting ? 0.7 : 1, flexShrink: 0 }}
                aria-label="Save new habit"
              >
                {submitting ? 'Saving...' : '+ Add Habit'}
              </button>
            </form>
          </section>
        </ErrorBoundary>

        {/* ============================================================ */}
        {/* SECTION 4: HABITS LIST (WRAPPED IN ERRORBOUNDARY)            */}
        {/* ============================================================ */}
        <ErrorBoundary sectionName="Habits List">
          <section className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Your Habits ({filteredHabits.length})
              </h2>

              <div style={{ display: 'flex', gap: 4, background: 'rgba(13, 17, 23, 0.6)', padding: 3, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'completed', label: 'Completed' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    aria-label={`Filter by ${f.label}`}
                    style={{
                      background: filter === f.id ? 'var(--brand-green)' : 'transparent',
                      color: filter === f.id ? '#0d1117' : 'var(--text-muted)',
                      border: 'none',
                      outline: 'none',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <div style={{
                  display: 'inline-block',
                  width: 30,
                  height: 30,
                  border: '3px solid rgba(62, 207, 142, 0.2)',
                  borderTopColor: 'var(--brand-green)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  marginBottom: 10
                }} />
                <p style={{ fontSize: '0.9rem', margin: 0 }}>Loading habits...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : filteredHabits.length === 0 ? (
              /* EMPTY LIST STATE FOR SECOND ACCOUNT AUDIT CHECK */
              <div style={{
                textAlign: 'center',
                padding: '40px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 14,
                border: '1px dashed var(--border-color)',
                margin: '10px 0'
              }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(62, 207, 142, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  fontSize: '1.6rem'
                }}>
                  🌱
                </div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: 6, fontWeight: 700 }}>
                  {filter !== 'all' ? 'No habits match this filter' : 'No habits tracked yet'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 400, margin: '0 auto' }}>
                  {filter !== 'all'
                    ? `You have no ${filter} habits right now.`
                    : 'This account has an empty list. Each account’s habits are isolated via Supabase Row-Level Security (RLS). Add your first habit above!'}
                </p>
              </div>
            ) : (
              /* Render Habits */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredHabits.map(item => {
                  const displayTitle = item.title || item.name || 'Untitled Habit'
                  const isEditing = editingId === item.id
                  const isQueued = item.isQueued

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: item.completed ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                        border: isQueued ? '1px dashed var(--accent-amber)' : '1px solid var(--border-color)',
                        borderRadius: 10,
                        transition: 'all 0.15s ease',
                        opacity: item.completed ? 0.75 : 1,
                        gap: 10,
                        flexWrap: 'wrap'
                      }}
                    >
                      {isEditing ? (
                        /* Inline Editing Mode */
                        <div style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="input-field"
                            aria-label="Edit title"
                            style={{ flex: '1 1 180px', padding: '7px 10px', minWidth: 0 }}
                          />
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="input-field"
                            aria-label="Edit category"
                            style={{ flex: '0 1 100px', padding: '7px 8px' }}
                          >
                            <option value="Dev">Dev</option>
                            <option value="Health">Health</option>
                            <option value="Productivity">Productivity</option>
                            <option value="Learning">Learning</option>
                            <option value="General">General</option>
                          </select>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            className="input-field"
                            aria-label="Edit priority"
                            style={{ flex: '0 1 95px', padding: '7px 8px' }}
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                          <button
                            onClick={() => saveEdit(item.id)}
                            disabled={savingEdit}
                            className="btn btn-primary"
                            style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                            aria-label="Save changes"
                          >
                            {savingEdit ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={savingEdit}
                            className="btn btn-secondary"
                            style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                            aria-label="Cancel editing"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        /* Standard Item View */
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={item.completed}
                              disabled={togglingId === item.id}
                              onChange={() => toggleHabit(item)}
                              aria-label={`Mark "${displayTitle}" as completed`}
                              style={{
                                width: 18,
                                height: 18,
                                accentColor: 'var(--brand-green)',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.94rem',
                                  color: item.completed ? 'var(--text-muted)' : 'var(--text-main)',
                                  textDecoration: item.completed ? 'line-through' : 'none',
                                  fontWeight: item.completed ? 400 : 500,
                                  wordBreak: 'break-word'
                                }}>
                                  {displayTitle}
                                </span>
                                {isQueued && (
                                  <span style={{
                                    fontSize: '0.7rem',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(227, 179, 65, 0.2)',
                                    color: '#e3b341',
                                    fontWeight: 700
                                  }}>
                                    Queued (Offline)
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className="code-inline" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                  {item.category || 'General'}
                                </span>
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: item.priority === 'High' ? 'rgba(248, 81, 73, 0.15)' : item.priority === 'Medium' ? 'rgba(227, 179, 65, 0.15)' : 'rgba(88, 166, 255, 0.15)',
                                  color: item.priority === 'High' ? '#ff7b72' : item.priority === 'Medium' ? '#e3b341' : '#79c0ff',
                                  fontWeight: 600
                                }}>
                                  {item.priority || 'Medium'}
                                </span>
                                {item.created_at && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {new Date(item.created_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Item Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {!isQueued && (
                              <button
                                onClick={() => startEditing(item)}
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                                aria-label={`Edit habit "${displayTitle}"`}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => deleteHabit(item.id)}
                              disabled={deletingId === item.id}
                              style={{
                                background: 'transparent',
                                border: '1px solid transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '5px 8px',
                                borderRadius: 6,
                                fontSize: '0.85rem',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.color = '#ff7b72'
                                e.target.style.borderColor = 'rgba(248, 81, 73, 0.3)'
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.color = 'var(--text-muted)'
                                e.target.style.borderColor = 'transparent'
                              }}
                              aria-label={`Delete habit "${displayTitle}"`}
                            >
                              {deletingId === item.id ? '...' : '✕'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </ErrorBoundary>
      </main>
    </div>
  )
}
