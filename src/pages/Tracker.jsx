import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import ErrorBoundary from '../components/ErrorBoundary'
import AvatarUpload from '../components/AvatarUpload'

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

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('Dev')
  const [newPriority, setNewPriority] = useState('Medium')
  const [submitting, setSubmitting] = useState(false)

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

  // ErrorBoundary test crash trigger state
  const [simulateCrash, setSimulateCrash] = useState(false)

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
      setError(err.message || 'Failed to fetch habits from database.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHabits()
  }, [user?.id])

  // ==========================================
  // 2. CREATE / INSERT
  // ==========================================
  const handleAddHabit = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || submitting || !user?.id) return

    setSubmitting(true)
    setActionError(null)

    const titleText = newTitle.trim()

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
        // Optionally insert initial log in daily_logs
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
      setActionError(`Failed to add habit: ${err.message}`)
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

    try {
      const { error: updateErr } = await supabase
        .from('habits')
        .update({ completed: nextCompleted })
        .eq('id', habit.id)

      if (updateErr) {
        throw updateErr
      }

      // Record daily log entry
      try {
        await supabase.from('daily_logs').insert([{
          habit_id: habit.id,
          user_id: user.id,
          completed: nextCompleted
        }])
      } catch {
        // ignore if daily_logs table is optional or already logged
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
  // 5. DELETE (Cascade removes logs automatically)
  // ==========================================
  const deleteHabit = async (id) => {
    if (!id || deletingId) return
    setDeletingId(id)
    setActionError(null)

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
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '36px 20px', minHeight: '100vh' }}>
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
          paddingBottom: 24,
          marginBottom: 28,
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3ecf8e 0%, #1c7c54 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(62, 207, 142, 0.35)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 11L12 14L22 4" stroke="#0d1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" stroke="#0d1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                Habit <span style={{ color: 'var(--brand-green)' }}>Tracker</span>
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Multi-tenant RLS &bull; Safe Storage &bull; Resilient Error Boundaries
              </p>
            </div>
          </div>

          {/* User Badge & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="glass-panel" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              borderRadius: 24,
              background: 'rgba(22, 27, 34, 0.85)'
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#3ecf8e',
                boxShadow: '0 0 8px #3ecf8e'
              }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                {user?.email}
              </span>
            </div>

            <button
              onClick={fetchHabits}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.82rem' }}
              title="Refresh from Supabase"
            >
              {loading ? '⟳ Loading...' : '⟳ Refresh'}
            </button>

            <button
              onClick={() => setShowSessionDetails(!showSessionDetails)}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              {showSessionDetails ? 'Hide Session' : 'Session Info'}
            </button>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.82rem', borderColor: 'rgba(248, 81, 73, 0.4)', color: '#ff7b72' }}
            >
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </header>

        {/* Session Details Drawer */}
        {showSessionDetails && (
          <section className="glass-panel" style={{ padding: 24, marginBottom: 28, borderColor: 'rgba(62, 207, 142, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--brand-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔐</span> Active Supabase Auth Session
              </h3>
              <button
                onClick={() => handleCopy(session?.access_token || '')}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                {copiedToken ? '✓ Copied Token' : 'Copy Access Token'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User UUID</span>
                <div className="code-block" style={{ marginTop: 4, padding: '8px 10px', fontSize: '0.8rem' }}>
                  {user?.id}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Provider</span>
                <div className="code-block" style={{ marginTop: 4, padding: '8px 10px', fontSize: '0.8rem' }}>
                  {user?.app_metadata?.provider || 'email'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Storage RLS Scope</span>
                <div className="code-block" style={{ marginTop: 4, padding: '8px 10px', fontSize: '0.8rem', color: 'var(--brand-green)' }}>
                  avatars/{user?.id?.slice(0, 8)}.../*
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Profile Avatar Upload Component */}
        <section style={{ marginBottom: 28 }}>
          <AvatarUpload user={user} />
        </section>
      </ErrorBoundary>

      {/* Global Action / Mutation Error Banner */}
      {actionError && (
        <div style={{
          padding: '12px 18px',
          background: 'rgba(248, 81, 73, 0.15)',
          border: '1px solid rgba(248, 81, 73, 0.4)',
          borderRadius: 10,
          color: '#ff7b72',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {actionError}</span>
          <button
            onClick={() => setActionError(null)}
            style={{ background: 'transparent', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Query Error Banner */}
      {error && (
        <div style={{
          padding: '16px 20px',
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
          <div>
            <strong>Database Query Error:</strong> {error}
            <div style={{ fontSize: '0.82rem', marginTop: 4, color: '#f0f6fc' }}>
              Ensure you have created the <span className="code-inline">habits</span> table and run the SQL migration in <span className="code-inline">supabase_schema.sql</span>.
            </div>
          </div>
          <button onClick={fetchHabits} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
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
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-sub)' }}>
              Overview & Analytics
            </h2>
            {/* Button to simulate an intentional component crash for deliverable screenshot */}
            <button
              onClick={() => setSimulateCrash(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                borderColor: 'rgba(248, 81, 73, 0.35)',
                color: '#ff7b72'
              }}
              title="Deliberately crashes this section to demonstrate ErrorBoundary fallback"
            >
              💥 Crash Section (Test Boundary)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Habits
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: 6 }}>
                {total}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--brand-green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Completed
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-green)', marginTop: 6 }}>
                {completedCount}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Remaining
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: 6 }}>
                {activeCount}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Completion Rate
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-purple)', marginTop: 6 }}>
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
        <section className="glass-panel" style={{ padding: '24px 28px', marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: 16, fontWeight: 700 }}>
            Add New Habit
          </h2>
          <form onSubmit={handleAddHabit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              required
              placeholder="e.g. Read 20 pages or Drink 2L water"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={submitting}
              className="input-field"
              style={{ flex: '1 1 280px' }}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={submitting}
              className="input-field"
              style={{ flex: '0 1 140px', cursor: 'pointer' }}
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
              style={{ flex: '0 1 130px', cursor: 'pointer' }}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <button
              type="submit"
              disabled={submitting || !newTitle.trim()}
              className="btn btn-primary"
              style={{ padding: '12px 24px', opacity: submitting ? 0.7 : 1 }}
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
        <section className="glass-panel" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Your Habits ({filteredHabits.length})
            </h2>

            <div style={{ display: 'flex', gap: 6, background: 'rgba(13, 17, 23, 0.6)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'completed', label: 'Completed' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    background: filter === f.id ? 'var(--brand-green)' : 'transparent',
                    color: filter === f.id ? '#0d1117' : 'var(--text-muted)',
                    border: 'none',
                    outline: 'none',
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: '0.82rem',
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
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
              <div style={{
                display: 'inline-block',
                width: 32,
                height: 32,
                border: '3px solid rgba(62, 207, 142, 0.2)',
                borderTopColor: 'var(--brand-green)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: 12
              }} />
              <p style={{ fontSize: '0.95rem' }}>Loading your habits from Supabase...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredHabits.length === 0 ? (
            /* EMPTY LIST STATE FOR AUDIT CHECK */
            <div style={{
              textAlign: 'center',
              padding: '50px 20px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 14,
              border: '1px dashed var(--border-color)',
              margin: '10px 0'
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(62, 207, 142, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                fontSize: '1.8rem'
              }}>
                🌱
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: 8, fontWeight: 700 }}>
                {filter !== 'all' ? 'No habits match this filter' : 'No habits tracked yet'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto' }}>
                {filter !== 'all'
                  ? `You have no ${filter} habits right now.`
                  : 'This account has an empty list. Each account’s habits are isolated via Supabase Row-Level Security (RLS). Add your first habit above!'}
              </p>
            </div>
          ) : (
            /* Render Habits */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredHabits.map(item => {
                const displayTitle = item.title || item.name || 'Untitled Habit'
                const isEditing = editingId === item.id

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      background: item.completed ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      transition: 'all 0.15s ease',
                      opacity: item.completed ? 0.75 : 1,
                      gap: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    {isEditing ? (
                      /* Inline Editing Mode */
                      <div style={{ display: 'flex', gap: 10, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="input-field"
                          style={{ flex: '1 1 200px', padding: '8px 12px' }}
                        />
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="input-field"
                          style={{ flex: '0 1 120px', padding: '8px 10px' }}
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
                          style={{ flex: '0 1 110px', padding: '8px 10px' }}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={savingEdit}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={savingEdit}
                          className="btn btn-secondary"
                          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Standard Display Mode */
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 260 }}>
                          <input
                            type="checkbox"
                            checked={item.completed}
                            disabled={togglingId === item.id}
                            onChange={() => toggleHabit(item)}
                            style={{
                              width: 18,
                              height: 18,
                              accentColor: 'var(--brand-green)',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <span style={{
                              fontSize: '0.98rem',
                              color: item.completed ? 'var(--text-muted)' : 'var(--text-main)',
                              textDecoration: item.completed ? 'line-through' : 'none',
                              fontWeight: item.completed ? 400 : 500
                            }}>
                              {displayTitle}
                            </span>
                            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                              <span className="code-inline" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                {item.category || 'General'}
                              </span>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: item.priority === 'High' ? 'rgba(248, 81, 73, 0.15)' : item.priority === 'Medium' ? 'rgba(227, 179, 65, 0.15)' : 'rgba(88, 166, 255, 0.15)',
                                color: item.priority === 'High' ? '#ff7b72' : item.priority === 'Medium' ? '#e3b341' : '#79c0ff',
                                fontWeight: 600
                              }}>
                                {item.priority || 'Medium'}
                              </span>
                              {item.created_at && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {new Date(item.created_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Item Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={() => startEditing(item)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            title="Edit Habit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteHabit(item.id)}
                            disabled={deletingId === item.id}
                            style={{
                              background: 'transparent',
                              border: '1px solid transparent',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '6px 10px',
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
                            title="Delete Habit"
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
    </div>
  )
}
