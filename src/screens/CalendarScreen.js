import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../hooks/useTasks';
import { useAllConflicts } from '../hooks/useConflicts';
import { useFocusEffect } from '@react-navigation/native';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen({ navigation }) {
  const { tasks, loading, refetch } = useTasks();
  const { hasConflictsOnDate, getConflictsForDate } = useAllConflicts(tasks);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  // ─── Calendar helpers ───

  const getYear = () => currentDate.getFullYear();
  const getMonth = () => currentDate.getMonth();

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const goToPrevMonth = () => {
    const prev = new Date(getYear(), getMonth() - 1, 1);
    setCurrentDate(prev);
  };

  const goToNextMonth = () => {
    const next = new Date(getYear(), getMonth() + 1, 1);
    setCurrentDate(next);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const isToday = (date) => isSameDay(date, new Date());

  // ─── Task helpers ───

  const getTaskDate = (deadline) => {
    const d = new Date(deadline);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getTasksForDate = (date) => {
    return tasks.filter((task) => {
      const taskDate = getTaskDate(task.deadline);
      return isSameDay(taskDate, date);
    });
  };

  const getTaskCountForDate = (date) => getTasksForDate(date).length;
    const getDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const hasHighPriority = (date) => {
    return getTasksForDate(date).some((t) => t.priorityLabel === 'High');
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Academic': return '#3b5bdb';
      case 'Organization': return '#9c36b5';
      case 'Personal': return '#0ca678';
      default: return '#a78bfa';
    }
  };

  const getPriorityColor = (label) => {
    switch (label) {
      case 'High': return '#ef4444';
      case 'Medium': return '#fb923c';
      case 'Low': return '#34d399';
      default: return '#a78bfa';
    }
  };

  const getStatusLabel = (progress) => {
    if (progress === 100) return 'Done';
    if (progress > 0) return 'In Progress';
    return 'To Do';
  };

  const getStatusColor = (progress) => {
    if (progress === 100) return '#34d399';
    if (progress > 0) return '#fb923c';
    return 'rgba(255,255,255,0.4)';
  };

  const getDeadlineUrgency = (deadline) => {
    const now = new Date();
    const dl = new Date(deadline);
    now.setHours(0, 0, 0, 0);
    dl.setHours(0, 0, 0, 0);
    const days = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: '#f87171' };
    if (days === 0) return { text: 'Due today', color: '#f87171' };
    if (days === 1) return { text: 'Due tomorrow', color: '#fbbf24' };
    return null;
  };

  // ─── Build calendar grid ───

  const buildCalendarDays = () => {
    const year = getYear();
    const month = getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const days = [];

    // Previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month's leading days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  // ─── Selected date tasks ───

  const selectedTasks = getTasksForDate(selectedDate)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const formatSelectedDate = () => {
    if (isToday(selectedDate)) return 'Today';
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // ─── Render ───

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const calendarDays = buildCalendarDays();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Calendar</Text>
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navArrow}>
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {MONTHS[getMonth()]} {getYear()}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={styles.dayHeaderRow}>
          {DAYS.map((day) => (
            <View key={day} style={styles.dayHeaderCell}>
              <Text style={[
                styles.dayHeaderText,
                (day === 'Sun' || day === 'Sat') && styles.dayHeaderWeekend,
              ]}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((item, index) => {
            const taskCount = getTaskCountForDate(item.date);
            const isSelected = isSameDay(item.date, selectedDate);
            const isTodayDate = isToday(item.date);
            const highPriority = hasHighPriority(item.date);
            const dateHasConflict = hasConflictsOnDate(getDateKey(item.date));

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isTodayDate && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(item.date)}
                activeOpacity={0.6}
              >
                <Text style={[
                  styles.dayText,
                  !item.isCurrentMonth && styles.dayTextFaded,
                  isSelected && styles.dayTextSelected,
                  isTodayDate && !isSelected && styles.dayTextToday,
                ]}>
                  {item.day}
                </Text>

                {/* Task dots + conflict indicator */}
                {taskCount > 0 && (
                  <View style={styles.dotRow}>
                    {dateHasConflict && (
                      <View style={[styles.dot, { backgroundColor: '#ef4444', width: 6, height: 6, borderRadius: 3 }]} />
                    )}
                    {taskCount >= 1 && !dateHasConflict && (
                      <View style={[
                        styles.dot,
                        { backgroundColor: highPriority ? '#ef4444' : '#a78bfa' },
                      ]} />
                    )}
                    {taskCount >= 2 && <View style={[styles.dot, { backgroundColor: '#fbbf24' }]} />}
                    {taskCount >= 3 && <View style={[styles.dot, { backgroundColor: '#34d399' }]} />}
                  </View>
                )}

              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Date Section */}
        <View style={styles.selectedSection}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedDate}>{formatSelectedDate()}</Text>
            <Text style={styles.selectedCount}>
              {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
            </Text>
          </View>

                    {/* Conflict banner for selected date */}
          {(() => {
            const dateConflicts = getConflictsForDate(getDateKey(selectedDate));
            if (dateConflicts.length === 0) return null;

            const totalConflicts = dateConflicts.reduce(
              (sum, entry) => sum + entry.conflicts.length,
              0
            );
            const firstTaskTitle = dateConflicts[0]?.task?.title || 'a task';

            return (
              <View style={styles.conflictBanner}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.conflictBannerText}>
                    {totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''} on this day
                  </Text>
                  <Text style={styles.conflictBannerSubtext} numberOfLines={1}>
                    Starting with "{firstTaskTitle}" — tap a task below to review
                  </Text>
                </View>
              </View>
            );
          })()}


          {selectedTasks.length === 0 ? (
            <View style={styles.emptyDay}>
              <Ionicons name="checkmark-circle-outline" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyDayText}>No tasks on this day</Text>
              <TouchableOpacity
                style={styles.addTaskLink}
                onPress={() => navigation.getParent()?.navigate('AddTask')}
              >
                <Ionicons name="add-circle-outline" size={16} color="#a78bfa" />
                <Text style={styles.addTaskLinkText}>Add a task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            selectedTasks.map((task) => {
              const catColor = getCategoryColor(task.category);
              const prioColor = getPriorityColor(task.priorityLabel);
              const statusColor = getStatusColor(task.progress);
              const urgency = getDeadlineUrgency(task.deadline);
              const hasTime = task.deadline && task.deadline.includes('T');

              return (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskCard, { borderLeftColor: catColor }]}
                  onPress={() => navigation.getParent()?.navigate('EditTask', { task })}
                  activeOpacity={0.7}
                >
                  <View style={styles.taskTopRow}>
                    <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                    <View style={[styles.prioBadge, { backgroundColor: `${prioColor}20` }]}>
                      <Text style={[styles.prioText, { color: prioColor }]}>
                        {task.priorityLabel}
                      </Text>
                    </View>
                  </View>

                  {task.description ? (
                    <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
                  ) : null}

                  <View style={styles.taskMetaRow}>
                    <View style={[styles.categoryChip, { backgroundColor: `${catColor}20` }]}>
                      <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
                      <Text style={[styles.categoryText, { color: catColor }]}>
                        {task.category}
                      </Text>
                    </View>

                    <View style={styles.statusChip}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={styles.statusText}>{getStatusLabel(task.progress)}</Text>
                    </View>

                    {hasTime && (
                      <View style={styles.timeChip}>
                        <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.timeText}>
                          {new Date(task.deadline).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </Text>
                      </View>
                    )}
                  </View>

                  {urgency && (
                    <View style={[styles.urgencyBanner, { backgroundColor: `${urgency.color}15` }]}>
                      <Ionicons name="alert-circle" size={13} color={urgency.color} />
                      <Text style={[styles.urgencyText, { color: urgency.color }]}>
                        {urgency.text}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, maxWidth: 600, alignSelf: 'center', width: '100%' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff' },
  todayButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  todayButtonText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },

  // Day headers
  dayHeaderRow: { flexDirection: 'row', marginBottom: 8 },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayHeaderText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  dayHeaderWeekend: { color: 'rgba(255,255,255,0.3)' },

  // Calendar grid
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  dayCellSelected: { backgroundColor: '#a78bfa' },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#a78bfa',
  },
  dayText: { fontSize: 14, fontWeight: '500', color: '#ffffff' },
  dayTextFaded: { color: 'rgba(255,255,255,0.2)' },
  dayTextSelected: { color: '#ffffff', fontWeight: '700' },
  dayTextToday: { color: '#a78bfa', fontWeight: '700' },

  // Dots
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  // Selected date section
  selectedSection: { marginTop: 4 },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  selectedDate: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  selectedCount: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  // Empty state
  emptyDay: { alignItems: 'center', paddingVertical: 32 },
  emptyDayText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    marginTop: 10,
    marginBottom: 12,
  },
  addTaskLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addTaskLinkText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },

  // Task cards
  taskCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  taskDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 8,
    lineHeight: 16,
  },
  prioBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  prioText: { fontSize: 10, fontWeight: '700' },

  // Meta row
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  categoryText: { fontSize: 11, fontWeight: '600' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
    // Conflict banner
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  conflictBannerText: {
    fontSize: 13,
    color: '#f87171',
    fontWeight: '600',
    flex: 1,
  },
    conflictBannerSubtext: {
    fontSize: 11,
    color: 'rgba(248,113,113,0.7)',
    marginTop: 2,
  },


  // Urgency banner
  urgencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  urgencyText: { fontSize: 11, fontWeight: '600' },
});
