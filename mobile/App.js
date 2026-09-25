import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import HabitListScreen from './screens/HabitListScreen'
import AddHabitScreen from './screens/AddHabitScreen'
import { supabase } from './lib/supabase'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('list') // 'list' | 'add'
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch initial habits from Supabase (with fallback demo data if not configured)
  const fetchHabits = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setHabits(data || [])
    } catch (err) {
      console.warn('Expo Supabase query warning (using local fallback state):', err.message)
      // Fallback state so Expo runs seamlessly out of the box
      if (habits.length === 0) {
        setHabits([
          { id: '1', title: 'Morning 5km Run', category: 'Health', priority: 'High', completed: true },
          { id: '2', title: 'Read 20 pages', category: 'Learning', priority: 'Medium', completed: false },
          { id: '3', title: 'Code Review & Push', category: 'Dev', priority: 'High', completed: false }
        ])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHabits()
  }, [])

  const handleToggle = async (id) => {
    const habit = habits.find(h => h.id === id)
    if (!habit) return
    const nextCompleted = !habit.completed

    // Optimistic local update
    setHabits(habits.map(h => h.id === id ? { ...h, completed: nextCompleted } : h))

    try {
      await supabase.from('habits').update({ completed: nextCompleted }).eq('id', id)
    } catch (err) {
      console.warn('Toggle sync warning:', err.message)
    }
  }

  const handleDelete = async (id) => {
    setHabits(habits.filter(h => h.id !== id))
    try {
      await supabase.from('habits').delete().eq('id', id)
    } catch (err) {
      console.warn('Delete sync warning:', err.message)
    }
  }

  const handleAdd = async (newHabit) => {
    const item = {
      id: String(Date.now()),
      ...newHabit,
      completed: false,
      created_at: new Date().toISOString()
    }

    setHabits([item, ...habits])
    setCurrentScreen('list')

    try {
      await supabase.from('habits').insert([newHabit])
    } catch (err) {
      console.warn('Add habit sync warning:', err.message)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {currentScreen === 'list' ? (
        <HabitListScreen
          habits={habits}
          loading={loading}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onNavigateAdd={() => setCurrentScreen('add')}
        />
      ) : (
        <AddHabitScreen
          onAdd={handleAdd}
          onCancel={() => setCurrentScreen('list')}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117'
  }
})
