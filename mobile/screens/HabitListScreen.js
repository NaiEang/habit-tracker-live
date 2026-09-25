import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native'
import { shareContent } from '../utils/share'

export default function HabitListScreen({ habits, loading, onToggle, onDelete, onNavigateAdd }) {
  const total = habits.length
  const completedCount = habits.filter(h => h.completed).length
  const rate = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const handleShare = async () => {
    await shareContent({
      title: 'Habit Tracker',
      message: `I am currently tracking ${total} habits with a ${rate}% completion rate on Habit Tracker!`
    })
  }

  const renderHabitItem = ({ item }) => (
    <View style={[styles.card, item.completed && styles.cardCompleted]}>
      <TouchableOpacity
        onPress={() => onToggle(item.id)}
        style={[styles.checkbox, item.completed && styles.checkboxCompleted]}
      >
        {item.completed && <Text style={styles.checkText}>✓</Text>}
      </TouchableOpacity>

      <View style={styles.habitInfo}>
        <Text style={[styles.habitTitle, item.completed && styles.habitTitleCompleted]}>
          {item.title || item.name || 'Untitled Habit'}
        </Text>
        <View style={styles.tagRow}>
          <Text style={styles.tagCategory}>{item.category || 'General'}</Text>
          <Text style={styles.tagPriority}>{item.priority || 'Medium'}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Habit <Text style={styles.brandText}>Tracker</Text></Text>
          <Text style={styles.headerSubtitle}>Native Mobile Port (Expo)</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Text style={styles.shareText}>🔗 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onNavigateAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#3ecf8e' }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#bc8cff' }]}>{rate}%</Text>
          <Text style={styles.statLabel}>Rate</Text>
        </View>
      </View>

      {/* Habits FlatList */}
      {loading ? (
        <ActivityIndicator size="large" color="#3ecf8e" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={habits}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderHabitItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🌱</Text>
              <Text style={styles.emptyTitle}>No habits tracked yet</Text>
              <Text style={styles.emptyText}>Tap "+ Add" to create your first habit on mobile!</Text>
            </View>
          }
        />
      )}
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
    marginBottom: 20
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f0f6fc'
  },
  brandText: {
    color: '#3ecf8e'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8
  },
  shareBtn: {
    backgroundColor: '#21262d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d'
  },
  shareText: {
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '600'
  },
  addBtn: {
    backgroundColor: '#3ecf8e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  addBtnText: {
    color: '#0d1117',
    fontSize: 13,
    fontWeight: '700'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  statBox: {
    flex: 1,
    backgroundColor: '#161b22',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f0f6fc'
  },
  statLabel: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 2,
    textTransform: 'uppercase'
  },
  listContent: {
    paddingBottom: 40
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  cardCompleted: {
    opacity: 0.65
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3ecf8e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  checkboxCompleted: {
    backgroundColor: '#3ecf8e'
  },
  checkText: {
    color: '#0d1117',
    fontSize: 14,
    fontWeight: '900'
  },
  habitInfo: {
    flex: 1
  },
  habitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0f6fc'
  },
  habitTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8b949e'
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6
  },
  tagCategory: {
    fontSize: 10,
    color: '#3ecf8e',
    backgroundColor: 'rgba(62, 207, 142, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  tagPriority: {
    fontSize: 10,
    color: '#e3b341',
    backgroundColor: 'rgba(227, 179, 65, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  deleteBtn: {
    padding: 6
  },
  deleteText: {
    color: '#8b949e',
    fontSize: 16
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f0f6fc'
  },
  emptyText: {
    fontSize: 13,
    color: '#8b949e',
    textAlign: 'center',
    marginTop: 6
  }
})
