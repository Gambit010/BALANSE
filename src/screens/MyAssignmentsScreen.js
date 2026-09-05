import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../firebase';
import { getAssignedTasks, updateTaskStatus } from '../services/taskService';
import { useTheme } from '../context/ThemeContext';

const StatusBadge = ({ status }) => {
  const colors = {
    'todo': { bg: '#374151', text: '#9CA3AF', label: 'To Do' },
    'in-progress': { bg: '#3B82F6', text: '#FFFFFF', label: 'In Progress' },
    'done': { bg: '#10B981', text: '#FFFFFF', label: 'Done' },
  };
  const style = colors[status] || colors['todo'];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.badgeText, { color: style.text }]}>{style.label}</Text>
    </View>
  );
};

export default function MyAssignmentsScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const currentUser = auth.currentUser;

  const fetchTasks = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log("Fetching tasks for:", currentUser.uid); // Debug log
      
      const data = await getAssignedTasks(currentUser.uid);
      
      console.log("Found tasks:", data.length); // Debug log

      // Sort: In Progress first, then To Do, then Done
      const sorted = data.sort((a, b) => {
        const order = { 'in-progress': 1, 'todo': 2, 'done': 3 };
        return (order[a.status] || 4) - (order[b.status] || 4);
      });
      
      setTasks(sorted);
    } catch (error) {
      console.error("CRITICAL ERROR in MyAssignments:", error);
      Alert.alert("Error", error.message || "Failed to load assignments");
    } finally {
      setLoading(false); // ALWAYS stops loading, even if error occurs
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    const success = await updateTaskStatus(task.id, newStatus);
    if (success) {
      fetchTasks(); // Refresh list
    } else {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getStatusOptions = (currentStatus) => {
    if (currentStatus === 'todo') return ['in-progress', 'done'];
    if (currentStatus === 'in-progress') return ['todo', 'done'];
    return ['todo', 'in-progress'];
  };

  const stats = {
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: theme.border }]}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>My Assignments</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* STATS CARDS */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.statNum, { color: '#EF4444' }]}>{stats.todo}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>To Do</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.statNum, { color: '#3B82F6' }]}>{stats.inProgress}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Active</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.statNum, { color: '#10B981' }]}>{stats.done}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Done</Text>
          </View>
        </View>

        {/* TASK LIST */}
        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={56} color={theme.subtext} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No assignments yet</Text>
            <Text style={[styles.emptySub, { color: theme.subtext }]}>
              Tasks assigned to you by your team will appear here.
            </Text>
          </View>
        ) : (
          tasks.map(task => (
            <View key={task.id} style={[styles.taskCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.taskHeader}>
                <View style={styles.taskTop}>
                  <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={1}>{task.title}</Text>
                  <StatusBadge status={task.status} />
                </View>
                <Text style={[styles.taskMeta, { color: theme.subtext }]}>
                  Due: {new Date(task.deadline).toLocaleDateString()}
                </Text>
              </View>

              {/* PROGRESS BAR */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { 
                  width: `${task.progress || 0}%`,
                  backgroundColor: task.progress === 100 ? '#10B981' : theme.accent 
                }]} />
              </View>

              {/* ACTION BUTTONS */}
              <View style={styles.actionRow}>
                {getStatusOptions(task.status).map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.actionBtn, { borderColor: theme.border }]}
                    onPress={() => handleStatusChange(task, status)}
                  >
                    <Text style={[styles.actionText, { color: theme.subtext }]}>
                      Mark as {status.replace('-', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 10 },
  statCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  taskCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  taskHeader: { marginBottom: 12 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  taskTitle: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  taskMeta: { fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 3 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  actionText: { fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});