import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from 'react-native'

export default function AddHabitScreen({ onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Dev')
  const [priority, setPriority] = useState('Medium')

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      category,
      priority
    })
  }

  const categories = ['Dev', 'Health', 'Productivity', 'Learning']
  const priorities = ['Low', 'Medium', 'High']

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Habit</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.label}>Habit Name</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Read 20 pages or Drink 2L water"
        placeholderTextColor="#8b949e"
        style={styles.input}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.optionsRow}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.optionBtn, category === c && styles.optionBtnActive]}
          >
            <Text style={[styles.optionText, category === c && styles.optionTextActive]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.optionsRow}>
        {priorities.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPriority(p)}
            style={[styles.optionBtn, priority === p && styles.optionBtnActive]}
          >
            <Text style={[styles.optionText, priority === p && styles.optionTextActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!title.trim()}
        style={[styles.saveBtn, !title.trim() && { opacity: 0.5 }]}
      >
        <Text style={styles.saveBtnText}>+ Save Habit</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingHorizontal: 16,
    paddingTop: 54
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  cancelText: {
    color: '#3ecf8e',
    fontSize: 15,
    fontWeight: '600'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f0f6fc'
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b949e',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  input: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    padding: 14,
    color: '#f0f6fc',
    fontSize: 15,
    marginBottom: 20
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  optionBtn: {
    flex: 1,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  optionBtnActive: {
    borderColor: '#3ecf8e',
    backgroundColor: 'rgba(62, 207, 142, 0.15)'
  },
  optionText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600'
  },
  optionTextActive: {
    color: '#3ecf8e',
    fontWeight: '700'
  },
  saveBtn: {
    backgroundColor: '#3ecf8e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  saveBtnText: {
    color: '#0d1117',
    fontSize: 15,
    fontWeight: '700'
  }
})
