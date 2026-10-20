import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTasks } from '../hooks/useTasks';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';
import PriorityBreakdownModal from '../components/PriorityBreakdownModal';
import TaskActionModal from '../components/TaskActionModal';
import { deleteTask, updateTaskProgress, updateTask, deleteUpcomingClassSessions, getClassSessionEnd } from '../services/taskService';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext'; // for dark mode
import { useUndoDelete } from '../hooks/useUndoDelete';
import UndoToast from '../components/UndoToast';
import { toLocalDateKey } from '../utils/dateUtils';

const FILTER_TYPES = [
  { key: 'category', label: 'Category' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'completed', label: 'Completed' },
];
const CATEGORY_FILTERS = ['All', 'Academic', 'Organization', 'Personal'];
const PRIORITY_FILTERS = ['All', 'High', 'Medium', 'Low'];
// Done tasks have their own tab, so Status only covers unfinished ones.
const STATUS_FILTERS = ['All', 'To Do', 'In Progress'];

export default function TasksScreen({ navigation, route }) {
  const { tasks, loading, refetch } = useTasks();
  const { theme, isDarkMode } = useTheme(); // for dark mode

  // Deletes always go through here as a list, so one Undo covers a single
  // task, a multi-select, or "Clear completed".
  const { pendingDelete, scheduleDelete, undoDelete } = useUndoDelete(async (items) => {
    const results = await Promise.all(items.map((t) => deleteTask(t.id)));
    refetch();
    const failed = items.filter((_, i) => !results[i]);
    if (failed.length === 1) {
      Alert.alert('Error', `Failed to delete "${failed[0].title}".`);
    } else if (failed.length > 1) {
      Alert.alert('Error', `Failed to delete ${failed.length} tasks.`);
    }
  });
  const pendingIds = new Set((pendingDelete || []).map((t) => t.id));

  // Classes live in the Calendar; this list is for tasks only.
  const visibleTasks = tasks.filter((t) => !t.recurrence?.isClassSchedule && !pendingIds.has(t.id));

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(route.params?.filterCategory || 'All');
  const [breakdownTask, setBreakdownTask] = useState(null);
  const [actionTask, setActionTask] = useState(null); // task currently showing the action modal
  const [filterType, setFilterType] = useState('category'); // 'category' | 'priority' | 'status' | 'completed'
  const [reschedulePickerTask, setReschedulePickerTask] = useState(null); // task currently showing the date picker
  const [selectedIds, setSelectedIds] = useState([]); // long-press multi-select
  const selectionMode = selectedIds.length > 0;

  // Refetch tasks and sync filter when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
      if (route.params?.filterCategory) {
        setFilterType('category');
        setActiveFilter(route.params.filterCategory || 'All');
      }
      return () => setSelectedIds([]); // leaving the tab ends selection
    }, [route.params?.filterCategory])
  );

  // Android back button leaves selection mode instead of the screen.
  useEffect(() => {
    if (!selectionMode) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedIds([]);
      return true;
    });
    return () => sub.remove();
  }, [selectionMode]);

  const showingCompleted = filterType === 'completed';

  const getActiveFilters = () => {
    switch (filterType) {
      case 'priority': return PRIORITY_FILTERS;
      case 'status': return STATUS_FILTERS;
      case 'completed': return [];
      default: return CATEGORY_FILTERS;
    }
  };

  // Filter tasks based on the tab, search and active filter
  const filteredTasks = visibleTasks.filter((task) => {
    // Completed tab shows only finished tasks; every other tab only unfinished ones.
    if (showingCompleted !== (task.progress === 100)) return false;

    const matchesSearch =
      searchQuery === '' ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesFilter = true;
    if (activeFilter !== 'All') {
      if (filterType === 'category') {
        matchesFilter = task.category === activeFilter;
      } else if (filterType === 'priority') {
        matchesFilter = task.priorityLabel === activeFilter;
      } else if (filterType === 'status') {
        matchesFilter = activeFilter === 'In Progress' ? task.progress > 0 : task.progress === 0;
      }
    }

    return matchesSearch && matchesFilter;
  });

  // Completed tab: most recent first. Other tabs keep the priority order from useTasks.
  const listTasks = showingCompleted
    ? [...filteredTasks].sort((a, b) => new Date(b.deadline) - new Date(a.deadline))
    : filteredTasks;
  const hasOpenTasks = visibleTasks.some((t) => t.progress !== 100);
  const hasDoneTasks = visibleTasks.some((t) => t.progress === 100);

  const changeFilterType = (type) => {
    setFilterType(type);
    setActiveFilter('All');
    setSelectedIds([]);
  };

  // ─── Multi-select ───

  const toggleSelect = (task) => {
    setSelectedIds((ids) => (ids.includes(task.id) ? ids.filter((id) => id !== task.id) : [...ids, task.id]));
  };

  const allSelected = listTasks.length > 0 && listTasks.every((t) => selectedIds.includes(t.id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : listTasks.map((t) => t.id));
  };

  const confirmDeleteSelected = () => {
    const items = visibleTasks.filter((t) => selectedIds.includes(t.id));
    if (items.length === 0) return;
    Alert.alert(
      `Delete ${items.length} task${items.length !== 1 ? 's' : ''}?`,
      'You can undo this for a few seconds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSelectedIds([]);
            scheduleDelete(items);
          },
        },
      ]
    );
  };

  const confirmClearCompleted = () => {
    const items = listTasks;
    if (items.length === 0) return;
    Alert.alert(
      `Clear ${items.length} completed task${items.length !== 1 ? 's' : ''}?`,
      'They will be removed from your tasks and calendar. You can undo this for a few seconds.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => scheduleDelete(items) },
      ]
    );
  };

  // ─── Task actions ───

  const handleReschedule = async (task, newDeadlineDate) => {
    const hasTime = task.deadline && task.deadline.includes('T');
    const newDeadline = hasTime
      ? newDeadlineDate.toISOString()
      : toLocalDateKey(newDeadlineDate);

    const score = computePriorityScore({ deadline: newDeadline, priority: task.priority, category: task.category });
    const success = await updateTask(task.id, {
      deadline: newDeadline,
      priorityScore: score,
      priorityLabel: getPriorityLabel(score),
    });
    if (success) {
      refetch();
    } else {
      Alert.alert('Error', 'Failed to reschedule task.');
    }
  };

  const handleDeleteSeries = (task) => {
    const templateName = task.recurrence?.templateName;
    if (!templateName) return;
    const now = new Date();
    const upcomingCount = tasks.filter(
      (t) => t.recurrence?.templateName === templateName && getClassSessionEnd(t) >= now
    ).length;

    if (upcomingCount === 0) {
      Alert.alert('Nothing to delete', `"${task.title}" has no upcoming sessions left.`);
      return;
    }

    Alert.alert(
      'Delete Upcoming Sessions',
      `Delete ${upcomingCount} upcoming session${upcomingCount !== 1 ? 's' : ''} of "${task.title}"? Past sessions stay in your calendar.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deleted = await deleteUpcomingClassSessions(task.userId, templateName);
            if (deleted < 0) Alert.alert('Error', 'Failed to delete the sessions.');
            refetch();
          },
        },
      ]
    );
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return '#ef4444';
      case 'Medium': return '#fb923c';
      case 'Low': return '#34d399';
      default: return '#a78bfa';
    }
  };

  // One task card. Tap opens the action sheet; long-press starts multi-select.
  const renderTaskCard = (task) => {
    const selected = selectedIds.includes(task.id);
    return (
      <TouchableOpacity
        key={task.id}
        style={[
          styles.taskCard,
          { backgroundColor: theme.card, borderColor: selected ? theme.accent : theme.border },
          selected && { backgroundColor: `${theme.accent}18` },
        ]}
        onPress={() => (selectionMode ? toggleSelect(task) : setActionTask(task))}
        onLongPress={() => toggleSelect(task)}
        delayLongPress={350}
        activeOpacity={0.7}
      >
        {/* Top Row - Title + Priority */}
        <View style={styles.taskTopRow}>
          {selectionMode && (
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={20}
              color={selected ? theme.accent : theme.subtext}
              style={styles.selectBox}
            />
          )}
          <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={1}>
            {task.title}
          </Text>
          {task.progress === 100 ? (
            <View style={[styles.priorityBadge, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
              <Text style={[styles.priorityText, { color: '#34d399' }]}>Done</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                if (selectionMode) toggleSelect(task);
                else setBreakdownTask(task);
              }}
              style={[
                styles.priorityBadge,
                { backgroundColor: `${getPriorityColor(task.priorityLabel)}20` },
              ]}
              activeOpacity={0.6}
            >
              <Text style={[styles.priorityText, { color: getPriorityColor(task.priorityLabel) }]}>
                {task.priorityLabel} ({task.priorityScore})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Plain, uncolored deadline text — priority already carries the color
            signal. Category, status, and description are one tap away in the
            action sheet. */}
        <Text style={[styles.taskDeadlineText, { color: theme.subtext }]}>
          {task.deadline && task.deadline.includes('T')
            ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              + ' at ' + new Date(task.deadline).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            : task.deadline}
        </Text>

        {/* Progress Bar */}
        <View style={[styles.taskProgressBg, { backgroundColor: theme.border }]}>
          <View style={[styles.taskProgressFill, { width: `${task.progress}%` }]} />
        </View>
      </TouchableOpacity>
    );
  };

  // What to say when the current list is empty.
  const emptyState = (() => {
    if (searchQuery) return { icon: 'search-outline', title: 'No tasks found', text: 'Try a different search term' };
    if (showingCompleted) return { icon: 'checkmark-done-outline', title: 'No completed tasks yet', text: 'Tasks you finish will show up here.' };
    if (!hasOpenTasks && hasDoneTasks) return { icon: 'happy-outline', title: 'All caught up', text: 'Finished tasks are in the Completed tab.' };
    if (activeFilter !== 'All') return { icon: 'funnel-outline', title: 'No tasks here', text: 'Try another filter.' };
    return { icon: 'document-text-outline', title: 'No tasks found', text: 'Tap + to create your first task' };
  })();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, selectionMode && { paddingBottom: 100 }]}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {selectionMode ? `${selectedIds.length} selected` : 'All Tasks'}
          </Text>
          {selectionMode ? (
            <TouchableOpacity onPress={toggleSelectAll}>
              <Text style={[styles.headerAction, { color: theme.accent }]}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.taskCount, { color: theme.text }]}>
              {listTasks.length} {showingCompleted ? 'completed' : `task${listTasks.length !== 1 ? 's' : ''}`}
            </Text>
          )}
        </View>

        {/* SEARCH BAR */}
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.subtext} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={showingCompleted ? 'Search completed tasks...' : 'Search tasks...'}
            placeholderTextColor={theme.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.subtext} />
            </TouchableOpacity>
          )}
        </View>

        {/* FILTER TYPE SELECTOR — Completed sits at the far right */}
        <View style={styles.filterTypeRow}>
          {FILTER_TYPES.map((type) => {
            const active = filterType === type.key;
            const isDoneTab = type.key === 'completed';
            return (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.filterTypeButton, { backgroundColor: theme.card, borderColor: theme.border },
                  active && (isDoneTab ? styles.filterTypeButtonDone : styles.filterTypeButtonActive),
                ]}
                onPress={() => changeFilterType(type.key)}
              >
                <Text
                  style={[
                    styles.filterTypeText, { color: theme.subtext },
                    active && (isDoneTab ? styles.filterTypeTextDone : styles.filterTypeTextActive),
                  ]}
                  numberOfLines={1}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* FILTER CHIPS (none on the Completed tab) */}
        {getActiveFilters().length > 0 && (
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
                  styles.filterChip, { backgroundColor: theme.card, borderColor: theme.border },
                  activeFilter === filter && styles.filterChipActive,
                ]}
                onPress={() => {
                  setActiveFilter(filter);
                  setSelectedIds([]);
                }}
              >
                <Text style={[
                  styles.filterChipText, { color: theme.subtext },
                  activeFilter === filter && { color: theme.subtext },
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* CLEAR COMPLETED */}
        {showingCompleted && listTasks.length > 0 && !selectionMode && (
          <TouchableOpacity style={styles.clearCompletedBtn} onPress={confirmClearCompleted}>
            <Ionicons name="trash-outline" size={15} color="#ef4444" />
            <Text style={styles.clearCompletedText}>
              Clear {listTasks.length} completed task{listTasks.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* EMPTY STATE */}
        {listTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name={emptyState.icon} size={48} color={theme.subtext} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{emptyState.title}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.text }]}>{emptyState.text}</Text>
          </View>
        )}

        {/* TASK LIST */}
        {listTasks.map(renderTaskCard)}

        {/* Hint, only until the list has a few tasks */}
        {!selectionMode && listTasks.length > 1 && (
          <Text style={[styles.longPressHint, { color: theme.subtext }]}>Tip: press and hold a task to select several.</Text>
        )}
      </ScrollView>

      {/* Priority Breakdown Modal */}
      <PriorityBreakdownModal
        visible={!!breakdownTask}
        task={breakdownTask}
        onClose={() => setBreakdownTask(null)}
      />

      {/* Task Action Modal — shown when a card is tapped */}
      <TaskActionModal
        visible={!!actionTask}
        task={actionTask}
        theme={theme}
        onClose={() => setActionTask(null)}
        onSetStatus={async (newProgress) => {
          const t = actionTask;
          setActionTask(null);
          if (t) {
            const success = await updateTaskProgress(t.id, newProgress);
            if (success) refetch();
          }
        }}
        onViewBreakdown={() => {
          setBreakdownTask(actionTask);
          setActionTask(null);
        }}
        onEdit={() => {
          const t = actionTask;
          setActionTask(null);
          navigation.navigate('EditTask', { task: t });
        }}
        onSnooze={() => {
          const t = actionTask;
          setActionTask(null);
          if (t) {
            const newDate = new Date(t.deadline);
            newDate.setDate(newDate.getDate() + 1);
            handleReschedule(t, newDate);
          }
        }}
        onPickDate={() => {
          const t = actionTask;
          setActionTask(null);
          setReschedulePickerTask(t);
        }}
        onDelete={() => {
          const t = actionTask;
          setActionTask(null);
          if (t) scheduleDelete([t]);
        }}
        onDeleteSeries={() => {
          const t = actionTask;
          setActionTask(null);
          if (t) handleDeleteSeries(t);
        }}
      />

      {/* Reschedule Date Picker — shown after picking "Pick a New Date" in TaskActionModal */}
      {reschedulePickerTask && (
        <DateTimePicker
          value={new Date(reschedulePickerTask.deadline)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            const t = reschedulePickerTask;
            setReschedulePickerTask(null);
            if (selectedDate && t) {
              handleReschedule(t, selectedDate);
            }
          }}
        />
      )}

      {pendingDelete && !selectionMode && (
        <UndoToast
          key={pendingDelete.map((t) => t.id).join(',')}
          message={pendingDelete.length === 1 ? 'Task deleted' : `${pendingDelete.length} tasks deleted`}
          onUndo={undoDelete}
          isDarkMode={isDarkMode}
        />
      )}

      {selectionMode ? (
        /* Selection bar replaces the + button while selecting */
        <View style={[styles.selectionBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.selectionCancel} onPress={() => setSelectedIds([])}>
            <Text style={[styles.selectionCancelText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectionDelete} onPress={confirmDeleteSelected}>
            <Ionicons name="trash-outline" size={18} color="#ffffff" />
            <Text style={styles.selectionDeleteText}>Delete ({selectedIds.length})</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Floating Add Button */
        <TouchableOpacity
          testID="add-task-button"
        accessibilityLabel="Add task"
        style={styles.addButton}
          onPress={() => navigation.navigate('AddTask')}
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    fontSize: 14,
    fontWeight: '700',
  },
  filterTypeButtonDone: {
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderColor: '#34d399',
  },
  filterTypeTextDone: {
    color: '#34d399',
    fontWeight: '700',
  },
  clearCompletedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  clearCompletedText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  selectBox: {
    marginRight: 8,
  },
  longPressHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 70,
  },
  selectionBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  selectionCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  selectionCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  selectionDelete: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ef4444',
  },
  selectionDeleteText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 30, 
    maxWidth: 600, 
    alignSelf: 'center',
    width: '100%' 
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
  },
  taskCount: {
    fontSize: 14,
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
    fontSize: 14,
  },
  filterTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTypeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
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
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
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
    flex: 1,
    marginRight: 8,
  },
  taskDescription: {
    fontSize: 13,
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
    marginBottom: 10,
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
  // Priority breakdown styles
  breakdownContainer: {
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a78bfa',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    marginBottom: 8,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  breakdownReason: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  breakdownBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 2,
  },
  breakdownBarFill: {
    height: 6,
    backgroundColor: '#a78bfa',
    borderRadius: 3,
  },
  breakdownScore: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'right',
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  breakdownTotalScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a78bfa',
  },
});