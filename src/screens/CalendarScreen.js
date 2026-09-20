import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../hooks/useTasks';
import { useAllConflicts } from '../hooks/useConflicts';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext'; // for dark mode
import { auth } from '../../firebase';
import { getMyAssignedBoardTasks } from '../services/teamService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen({ navigation }) {
  const { tasks, loading, refetch } = useTasks();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [teamAssignedTasks, setTeamAssignedTasks] = useState([]);
  const { theme, isDarkMode } = useTheme(); // for dark mode

  // Team tasks assigned to this user, merged in the same way HomeScreen does —
  // otherwise a team deadline never shows up here at all and can't be checked
  // against personal-task conflicts.
  const fetchTeamTasks = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const raw = await getMyAssignedBoardTasks(currentUser.uid);
    const normalized = raw.map((t) => {
      const score = computePriorityScore(t);
      return {
        ...t,
        priorityScore: score,
        priorityLabel: getPriorityLabel(score),
        isTeamTask: true,
      };
    });
    setTeamAssignedTasks(normalized);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      fetchTeamTasks();
    }, [fetchTeamTasks])
  );

  const allTasks = useMemo(() => [...tasks, ...teamAssignedTasks], [tasks, teamAssignedTasks]);
  const { hasConflictsOnDate, getConflictsForDate } = useAllConflicts(allTasks);

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
    setWeekAnchor(today);
  };

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const isToday = (date) => isSameDay(date, new Date());

  // ─── Week helpers ───

  const getWeekStart = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };

  const getWeekDays = (anchor) => {
    const start = getWeekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const goToPrevWeek = () => {
    const prev = new Date(weekAnchor);
    prev.setDate(prev.getDate() - 7);
    setWeekAnchor(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekAnchor);
    next.setDate(next.getDate() + 7);
    setWeekAnchor(next);
  };

  const formatWeekRangeLabel = (anchor) => {
    const start = getWeekStart(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', {
      month: sameMonth ? undefined : 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startStr} – ${endStr}`;
  };

  // ─── Task helpers ───

  const getTaskDate = (deadline) => {
    const d = new Date(deadline);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Precompute once per task-list change instead of re-scanning the full task
  // array for every one of the ~42 grid cells (and now 7 week-view days) on
  // every render.
  const tasksByDateKey = useMemo(() => {
    const map = new Map();
    for (const task of allTasks) {
      if (!task.deadline) continue;
      const key = getDateKey(getTaskDate(task.deadline));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    }
    return map;
  }, [allTasks]);

  const getTasksForDate = (date) => tasksByDateKey.get(getDateKey(date)) || [];

  const getTaskCountForDate = (date) => getTasksForDate(date).length;

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
    return 'rgb(106, 103, 103)';
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

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

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

  // ─── Shared task card renderer (Month's selected-day list AND Week view) ───

  const renderTaskCard = (task) => {
    const catColor = getCategoryColor(task.category);
    const prioColor = getPriorityColor(task.priorityLabel);
    const statusColor = getStatusColor(task.progress);
    const urgency = getDeadlineUrgency(task.deadline);
    const hasTime = task.deadline && task.deadline.includes('T');

    return (
      <TouchableOpacity
        key={task.id}
        style={[styles.taskCard, { borderLeftColor: catColor, backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => navigation.getParent()?.navigate('EditTask', { task })}
        activeOpacity={0.7}
      >
        <View style={styles.taskTopRow}>
          <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={1}>{task.title}</Text>
          <View style={[styles.prioBadge, { backgroundColor: `${prioColor}20` }]}>
            <Text style={[styles.prioText, { color: prioColor }]}>{task.priorityLabel}</Text>
          </View>
        </View>

        {task.description ? (
          <Text style={[styles.taskDesc, { color: theme.subtext }]} numberOfLines={1}>{task.description}</Text>
        ) : null}

        <View style={styles.taskMetaRow}>
          <View style={[styles.categoryChip, { backgroundColor: `${catColor}20` }]}>
            <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
            <Text style={[styles.categoryText, { color: catColor }]}>{task.category}</Text>
          </View>

          {task.isTeamTask && (
            <View style={styles.teamTag}>
              <Ionicons name="people-outline" size={10} color="#a78bfa" />
              <Text style={styles.teamTagText}>Team</Text>
            </View>
          )}

          <View style={styles.statusChip}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: theme.subtext }]}>{getStatusLabel(task.progress)}</Text>
          </View>

          {hasTime && (
            <View style={styles.timeChip}>
              <Ionicons name="time-outline" size={11} color={theme.subtext} />
              <Text style={[styles.timeText, { color: theme.subtext }]}>
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
            <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.text}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Render ───

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading calendar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const calendarDays = buildCalendarDays();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Calendar</Text>
          <View style={styles.headerActions}>
            <View style={[styles.viewToggle, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'month' && { backgroundColor: theme.accent }]}
                onPress={() => setViewMode('month')}
              >
                <Text style={[styles.viewToggleText, { color: viewMode === 'month' ? '#ffffff' : theme.subtext }]}>
                  Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'week' && { backgroundColor: theme.accent }]}
                onPress={() => setViewMode('week')}
              >
                <Text style={[styles.viewToggleText, { color: viewMode === 'week' ? '#ffffff' : theme.subtext }]}>
                  Week
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.todayButton, {
                backgroundColor: isDarkMode ? 'rgba(167,139,250,0.15)' : '#F3E8FF',
                borderColor: theme.accent,
              }]}
              onPress={goToToday}
            >
              <Text style={[styles.todayButtonText, { color: theme.accent }]}>Today</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Month / Week Navigation */}
        {viewMode === 'month' ? (
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={[styles.navArrow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="chevron-back" size={22} color={theme.icon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPickerYear(getYear()); setPickerVisible(true); }}>
              <Text style={[styles.monthText, { color: theme.text }]}>
                {MONTHS[getMonth()]} {getYear()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goToNextMonth} style={[styles.navArrow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="chevron-forward" size={22} color={theme.icon} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevWeek} style={[styles.navArrow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="chevron-back" size={22} color={theme.icon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPickerYear(weekAnchor.getFullYear()); setPickerVisible(true); }}>
              <Text style={[styles.monthText, { color: theme.text }]}>
                {formatWeekRangeLabel(weekAnchor)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goToNextWeek} style={[styles.navArrow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="chevron-forward" size={22} color={theme.icon} />
            </TouchableOpacity>
          </View>
        )}

        {viewMode === 'month' ? (
          <>
            {/* Day Headers */}
            <View style={styles.dayHeaderRow}>
              {DAYS.map((day) => (
                <View key={day} style={styles.dayHeaderCell}>
                  <Text style={[styles.dayHeaderText, { color: theme.text }]}>{day}</Text>
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
                      isSelected && { backgroundColor: theme.accent },
                      isTodayDate && !isSelected && { borderWidth: 1.5, borderColor: theme.accent },
                    ]}
                    onPress={() => setSelectedDate(item.date)}
                    activeOpacity={0.6}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: item.isCurrentMonth ? theme.text : theme.subtext },
                      isSelected && { color: theme.text },
                      isTodayDate && !isSelected && { color: theme.accent },
                    ]}>
                      {item.day}
                    </Text>

                    {taskCount > 0 && (
                      <Text
                        style={[
                          styles.dayTaskCount,
                          {
                            color: isSelected
                              ? theme.text
                              : dateHasConflict
                              ? '#ef4444'
                              : highPriority
                              ? '#fb923c'
                              : theme.subtext,
                          },
                        ]}
                      >
                        {taskCount} task{taskCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Date Section */}
            <View style={styles.selectedSection}>
              <View style={styles.selectedHeader}>
                <Text style={[styles.selectedDate, { color: theme.text }]}>{formatSelectedDate()}</Text>
                <Text style={[styles.selectedCount, { color: theme.subtext }]}>
                  {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {(() => {
                const dateConflicts = getConflictsForDate(getDateKey(selectedDate));
                if (dateConflicts.length === 0) return null;

                const totalConflicts = dateConflicts.reduce(
                  (sum, entry) => sum + entry.conflicts.length,
                  0
                );
                const firstTaskTitle = dateConflicts[0]?.task?.title || 'a task';

                return (
                  <View style={[styles.conflictBanner, {
                    backgroundColor: isDarkMode ? 'rgba(239,68,68,0.10)' : '#FEF2F2',
                    borderColor: '#ef4444',
                  }]}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.conflictBannerText, { color: '#ef4444' }]}>
                        {totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''} on this day
                      </Text>
                      <Text style={[styles.conflictBannerSubtext, { color: theme.text }]} numberOfLines={1}>
                        Starting with "{firstTaskTitle}" — tap a task below to review
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {selectedTasks.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={theme.subtext} />
                  <Text style={[styles.emptyDayText, { color: theme.subtext }]}>No tasks on this day</Text>
                  <TouchableOpacity
                    style={styles.addTaskLink}
                    onPress={() => navigation.getParent()?.navigate('AddTask')}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={theme.accent} />
                    <Text style={[styles.addTaskLinkText, { color: theme.accent }]}>Add a task</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                selectedTasks.map(renderTaskCard)
              )}
            </View>
          </>
        ) : (
          /* Week View */
          <View style={styles.weekContainer}>
            {getWeekDays(weekAnchor).map((date) => {
              const dayTasks = getTasksForDate(date).sort((a, b) => b.priorityScore - a.priorityScore);
              const dateConflicts = getConflictsForDate(getDateKey(date));
              const totalConflicts = dateConflicts.reduce((sum, entry) => sum + entry.conflicts.length, 0);
              const todayDate = isToday(date);

              return (
                <View key={date.toISOString()} style={styles.weekDaySection}>
                  <View style={styles.weekDayHeader}>
                    <Text style={[styles.weekDayName, { color: todayDate ? theme.accent : theme.text }]}>
                      {date.toLocaleDateString('en-US', { weekday: 'long' })}
                    </Text>
                    <Text style={[styles.weekDayNum, { color: todayDate ? theme.accent : theme.subtext }]}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    {totalConflicts > 0 && (
                      <View style={styles.weekConflictTag}>
                        <Ionicons name="alert-circle" size={12} color="#ef4444" />
                        <Text style={styles.weekConflictTagText}>
                          {totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {dayTasks.length === 0 ? (
                    <Text style={[styles.weekEmptyText, { color: theme.subtext }]}>No tasks</Text>
                  ) : (
                    dayTasks.map(renderTaskCard)
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Month / Year Picker */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.pickerSheet, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {}}
          >
            <View style={styles.pickerYearRow}>
              <TouchableOpacity
                onPress={() => setPickerYear((y) => y - 1)}
                style={[styles.navArrow, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}
              >
                <Ionicons name="chevron-back" size={20} color={theme.icon} />
              </TouchableOpacity>
              <Text style={[styles.pickerYearText, { color: theme.text }]}>{pickerYear}</Text>
              <TouchableOpacity
                onPress={() => setPickerYear((y) => y + 1)}
                style={[styles.navArrow, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.icon} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerMonthGrid}>
              {MONTHS.map((m, idx) => {
                const isActive = viewMode === 'month'
                  ? idx === getMonth() && pickerYear === getYear()
                  : idx === weekAnchor.getMonth() && pickerYear === weekAnchor.getFullYear();

                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerMonthCell, isActive && { backgroundColor: theme.accent }]}
                    onPress={() => {
                      if (viewMode === 'month') {
                        setCurrentDate(new Date(pickerYear, idx, 1));
                      } else {
                        setWeekAnchor(new Date(pickerYear, idx, 1));
                      }
                      setPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.pickerMonthText, { color: isActive ? '#ffffff' : theme.text }]}>
                      {m.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f0f23' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    color: 'rgba(255,255,255,0.5)', 
    marginTop: 12, 
    fontSize: 14 
  },
  scroll: { 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    maxWidth: 600, 
    alignSelf: 'center', 
    width: '100%' 
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#ffffff' 
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  todayButtonText: { 
    color: '#a78bfa', 
    fontSize: 13, 
    fontWeight: '600' 
  },

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
  monthText: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#ffffff' 
  },

  // Day headers
  dayHeaderRow: { 
    flexDirection: 'row', 
    marginBottom: 8 
  },
  dayHeaderCell: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 4 
  },
  dayHeaderText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: 'rgba(255,255,255,0.5)' 
  },
  dayHeaderWeekend: { 
    color: 'rgba(255,255,255,0.3)' 
  },

  // Calendar grid
  calendarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 24 
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  dayCellSelected: { 
    backgroundColor: '#a78bfa' 
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#a78bfa',
  },
  dayText: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: '#ffffff' 
  },
  dayTextFaded: { 
    color: 'rgba(255,255,255,0.2)' 
  },
  dayTextSelected: { 
    color: '#ffffff', 
    fontWeight: '700' 
  },
  dayTextToday: { 
    color: '#a78bfa', 
    fontWeight: '700' 
  },

  // Day task-count text (replaces the old dots)
  dayTaskCount: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },

  // Dots (unused, kept for reference)
  dotRow: { 
    flexDirection: 'row', 
    gap: 3, 
    marginTop: 4 
  },
  dot: { 
    width: 5, 
    height: 5, 
    borderRadius: 2.5 
  },

  // Selected date section
  selectedSection: { 
    marginTop: 4 
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  selectedDate: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#ffffff' 
  },
  selectedCount: { 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.4)' 
  },

  // Empty state
  emptyDay: { 
    alignItems: 'center', 
    paddingVertical: 32 
  },
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
  addTaskLinkText: {
     color: '#a78bfa', 
     fontSize: 13, 
     fontWeight: '600' 
    },

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
  prioBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 6 
  },
  prioText: { 
    fontSize: 10, 
    fontWeight: '700' 
  },

  // Meta row
  taskMetaRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    flexWrap: 'wrap' 
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  categoryDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3 
  },
  categoryText: { 
    fontSize: 11, 
    fontWeight: '600' 
  },
  teamTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(167,139,250,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  teamTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a78bfa',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3 
  },
  statusText: { 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.5)' 
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: { 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.5)' 
  },
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
  urgencyText: { 
    fontSize: 11, 
    fontWeight: '600' 
  },

  // Month/Year picker modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerSheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  pickerYearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerYearText: {
    fontSize: 18,
    fontWeight: '700',
  },
  pickerMonthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerMonthCell: {
    width: '25%',
    aspectRatio: 1.4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  pickerMonthText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Week view
  weekContainer: {
    marginTop: 4,
  },
  weekDaySection: {
    marginBottom: 20,
  },
  weekDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  weekDayName: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekDayNum: {
    fontSize: 13,
  },
  weekConflictTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  weekConflictTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  weekEmptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});