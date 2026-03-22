import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../hooks/useTasks';
import { deleteTask, updateTaskProgress } from '../services/taskService';
import { useFocusEffect } from '@react-navigation/native';

export default function TasksScreen({ navigation }) {
  const { tasks, loading, refetch } = useTasks();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [filterType, setFilterType] = useState('category'); // 'category' | 'priority' | 'status'

  // Refetch tasks when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  const categoryFilters = ['All', 'Academic', 'Organization', 'Personal'];
  const priorityFilters = ['All', 'High', 'Medium', 'Low'];
  const statusFilters = ['All', 'To Do', 'In Progress', 'Completed'];

  const getActiveFilters = () => {
    switch (filterType) {
      case 'priority': return priorityFilters;
      case 'status': return statusFilters;
      default: return categoryFilters;
    }
  };

  // Filter tasks based on search and active filter
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    const matchesSearch =
      searchQuery === '' ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());

    // Category/Priority/Status filter
    let matchesFilter = true;
    if (activeFilter !== 'All') {
      if (filterType === 'category') {
        matchesFilter = task.category === activeFilter;
      } else if (filterType === 'priority') {
        matchesFilter = task.priorityLabel === activeFilter;
      } else if (filterType === 'status') {
        if (activeFilter === 'Completed') {
          matchesFilter = task.progress === 100;
        } else if (activeFilter === 'In Progress') {
          matchesFilter = task.progress > 0 && task.progress < 100;
        } else if (activeFilter === 'To Do') {
          matchesFilter = task.progress === 0;
        }
      }
    }

    return matchesSearch && matchesFilter;
  });

  const handleDelete = (taskId, taskTitle) => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${taskTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteTask(taskId);
            if (success) {
              refetch();
            } else {
              Alert.alert('Error', 'Failed to delete task.');
            }
          },
        },
      ]
    );
  };

  const handleProgressUpdate = async (taskId, currentProgress) => {
    const newProgress = currentProgress >= 100 ? 0 : currentProgress + 25;
    const success = await updateTaskProgress(taskId, newProgress);
    if (success) {
      refetch();
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return '#ef4444';
      case 'Medium': return '#fb923c';
      case 'Low': return '#34d399';
      default: return '#a78bfa';
    }
  };

  const getStatusLabel = (progress) => {
    if (progress === 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'To Do';
  };

  const getStatusColor = (progress) => {
    if (progress === 100) return '#34d399';
    if (progress > 0) return '#fb923c';
    return 'rgba(255,255,255,0.4)';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>All Tasks</Text>
          <Text style={styles.taskCount}>{filteredTasks.length} tasks</Text>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>

        {/* FILTER TYPE SELECTOR */}
        <View style={styles.filterTypeRow}>
          {['category', 'priority', 'status'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterTypeButton,
                filterType === type && styles.filterTypeButtonActive,
              ]}
              onPress={() => {
                setFilterType(type);
                setActiveFilter('All');
              }}
            >
              <Text style={[
                styles.filterTypeText,
                filterType === type && styles.filterTypeTextActive,
              ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FILTER CHIPS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {getActiveFilters().map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[
                styles.filterChipText,
                activeFilter === filter && styles.filterChipTextActive,
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* EMPTY STATE */}
        {filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>No tasks found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Tap + to create your first task'}
            </Text>
          </View>
        )}

        {/* TASK LIST */}
        {filteredTasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={styles.taskCard}
            onPress={() => navigation.navigate('EditTask', { task })}
            activeOpacity={0.7}
          >
            {/* Top Row - Title + Priority */}
            <View style={styles.taskTopRow}>
              <Text style={styles.taskTitle} numberOfLines={1}>
                {task.title}
              </Text>
              <View style={[
                styles.priorityBadge,
                { backgroundColor: `${getPriorityColor(task.priorityLabel)}20` },
              ]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(task.priorityLabel) }]}>
                  {task.priorityLabel}
                </Text>
              </View>
            </View>

            {/* Description */}
            {task.description ? (
              <Text style={styles.taskDescription} numberOfLines={2}>
                {task.description}
              </Text>
            ) : null}

            {/* Mid Row - Category, Status, Deadline */}
            <View style={styles.taskMidRow}>
              <View style={styles.taskMeta}>
                <View style={styles.metaChip}>
                  <Ionicons name="folder-outline" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.metaText}>{task.category}</Text>
                </View>
                <View style={[styles.metaChip, { borderColor: `${getStatusColor(task.progress)}40` }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.progress) }]} />
                  <Text style={styles.metaText}>{getStatusLabel(task.progress)}</Text>
                </View>
              </View>
              <View style={styles.taskDeadline}>
                <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.4)" />
                <Text style={styles.taskDeadlineText}>{task.deadline}</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.taskProgressBg}>
              <View style={[styles.taskProgressFill, { width: `${task.progress}%` }]} />
            </View>

            {/* Bottom Row - Actions */}
            <View style={styles.taskBottomRow}>
              <TouchableOpacity
                style={styles.progressButton}
                onPress={() => handleProgressUpdate(task.id, task.progress)}
              >
                <Ionicons
                  name={task.progress === 100 ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={20}
                  color={task.progress === 100 ? '#34d399' : 'rgba(255,255,255,0.4)'}
                />
                <Text style={styles.taskProgressText}>{task.progress}%</Text>
              </TouchableOpacity>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => navigation.navigate('EditTask', { task })}
                >
                  <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDelete(task.id, task.title)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddTask')}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  taskCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a3e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  filterTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTypeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#1a1a3e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterTypeButtonActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: '#a78bfa',
  },
  filterTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  filterTypeTextActive: {
    color: '#a78bfa',
    fontWeight: '700',
  },
  filterScroll: {
    marginBottom: 20,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1a1a3e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderColor: '#a78bfa',
  },
  filterChipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 6,
  },
  taskCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  taskDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
    lineHeight: 18,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskMidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDeadlineText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  taskProgressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 10,
  },
  taskProgressFill: {
    height: 4,
    backgroundColor: '#a78bfa',
    borderRadius: 2,
  },
  taskBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
