import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { addTask, addRecurringTask } from '../services/taskService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';
import { checkAndNotifyConflicts } from '../services/conflictService';
import { detectConflicts } from '../services/conflictService';
import { useTaskConflicts } from '../hooks/useConflicts';
import { useTasks } from '../hooks/useTasks';
import ConflictAlert from '../components/ConflictAlert';
import DateTimePicker from '@react-native-community/datetimepicker';


export default function AddTaskScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Academic');
  const [priority, setPriority] = useState('Low');
  const [deadline, setDeadline] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasTime, setHasTime] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Repeat state
  const [isRepeat, setIsRepeat] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [durationPreset, setDurationPreset] = useState('4weeks');
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState('weeks');

  // Per-day time overrides
  const [dayTimeOverrides, setDayTimeOverrides] = useState({});
  const [editingDay, setEditingDay] = useState(null);
  const [editingField, setEditingField] = useState(null);

  const defaultStart = { hour: 17, minute: 0 };
  const defaultEnd = { hour: 18, minute: 0 };

  const { tasks: existingTasks } = useTasks();

  const pendingTask = useMemo(() => ({
    title: title.trim(),
    category,
    priority,
    deadline: hasTime ? deadline.toISOString() : deadline.toISOString().split('T')[0],
  }), [category, priority, deadline, hasTime]);

  const { conflicts, hasHighConflicts } = useTaskConflicts(pendingTask, existingTasks);

  // --- Per-day time helpers ---
  const getDayTime = (day) => {
    if (dayTimeOverrides[day]) return dayTimeOverrides[day];
    return { startHour: defaultStart.hour, startMinute: defaultStart.minute, endHour: defaultEnd.hour, endMinute: defaultEnd.minute };
  };

  const formatTime = (hour, minute) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getPickerValue = () => {
    if (!editingDay) return new Date();
    const times = getDayTime(editingDay);
    const d = new Date();
    if (editingField === 'start') {
      d.setHours(times.startHour, times.startMinute, 0, 0);
    } else {
      d.setHours(times.endHour, times.endMinute, 0, 0);
    }
    return d;
  };

  const handleDayTimeChange = (event, selectedDate) => {
    if (!editingDay || !selectedDate) {
      setEditingDay(null);
      setEditingField(null);
      return;
    }
    const current = getDayTime(editingDay);
    const updated = { ...current };
    if (editingField === 'start') {
      updated.startHour = selectedDate.getHours();
      updated.startMinute = selectedDate.getMinutes();
    } else {
      updated.endHour = selectedDate.getHours();
      updated.endMinute = selectedDate.getMinutes();
    }
    setDayTimeOverrides(prev => ({ ...prev, [editingDay]: updated }));
    setEditingDay(null);
    setEditingField(null);
  };

  // --- Repeat helpers ---
  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const getDurationWeeks = () => {
    switch (durationPreset) {
      case '4weeks': return 4;
      case '8weeks': return 8;
      case '4months': return 16;
      case 'custom': {
        const val = parseInt(customValue, 10) || 0;
        return customUnit === 'months' ? val * 4 : val;
      }
      default: return 4;
    }
  };

  const getEndDate = () => {
    const weeks = getDurationWeeks();
    const end = new Date();
    end.setDate(end.getDate() + weeks * 7);
    return end;
  };

  const countSessions = () => {
    if (selectedDays.length === 0) return 0;
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const targets = selectedDays.map(d => dayMap[d]);
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    const end = getEndDate();
    end.setHours(23, 59, 59, 999);
    let count = 0;
    const iter = new Date(current);
    while (iter <= end) {
      if (targets.includes(iter.getDay())) count++;
      iter.setDate(iter.getDate() + 1);
    }
    return count;
  };

  const sessionCount = isRepeat ? countSessions() : 0;

  // Build session tasks for conflict checking
  const buildSessionTasks = () => {
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const targets = selectedDays.map(d => dayMap[d]);
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    const end = getEndDate();
    end.setHours(23, 59, 59, 999);
    const sessions = [];
    const iter = new Date(current);

    while (iter <= end) {
      if (targets.includes(iter.getDay())) {
        const dayAbbr = Object.keys(dayMap).find(k => dayMap[k] === iter.getDay());
        const times = getDayTime(dayAbbr);
        const taskDate = new Date(iter);
        taskDate.setHours(times.startHour, times.startMinute, 0, 0);

        sessions.push({
          title: title.trim(),
          category,
          priority,
          deadline: taskDate.toISOString(),
        });
      }
      iter.setDate(iter.getDate() + 1);
    }
    return sessions;
  };

  // --- Save logic ---
  const saveTask = async () => {
    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      const taskData = {
        userId: currentUser.uid,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        deadline: hasTime ? deadline.toISOString() : deadline.toISOString().split('T')[0],
        priorityScore: 0,
        assignments: [],
      };
      const score = computePriorityScore(taskData);
      taskData.priorityScore = score;
      taskData.priorityLabel = getPriorityLabel(score);

      const taskId = await addTask(taskData);
      if (taskId) {
        taskData.id = taskId;
        await checkAndNotifyConflicts(currentUser.uid, taskData, existingTasks);
        Alert.alert('Task Added', `"${title}" has been added with a priority score of ${score}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        Alert.alert('Error', 'Failed to save task. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveRecurringTask = async () => {
    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;

      // Build dayTimes map for all selected days
      const dayTimes = {};
      selectedDays.forEach(day => {
        dayTimes[day] = getDayTime(day);
      });

      const templateData = {
        userId: currentUser.uid,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      };

      const endDate = getEndDate();
      const created = await addRecurringTask(templateData, selectedDays, endDate, dayTimes);

      if (created > 0) {
        Alert.alert(
          'Recurring Task Added',
          `"${title}" — ${created} sessions created (${selectedDays.join(', ')}) for ${getDurationWeeks()} weeks.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', 'No sessions were created. Check your day and duration selections.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Please enter a task title'); return; }
    if (!description.trim()) { Alert.alert('Error', 'Please enter a task description'); return; }

    if (isRepeat) {
      if (selectedDays.length === 0) {
        Alert.alert('Error', 'Please select at least one day for the recurring task');
        return;
      }
      if (durationPreset === 'custom' && (!customValue || parseInt(customValue, 10) <= 0)) {
        Alert.alert('Error', 'Please enter a valid custom duration');
        return;
      }

      // Conflict checking for recurring tasks
      const sessions = buildSessionTasks();
      let conflictCount = 0;
      sessions.forEach(session => {
        const found = detectConflicts(session, existingTasks);
        const highConflicts = found.filter(c => c.severity === 'high');
        conflictCount += highConflicts.length;
      });

      if (conflictCount > 0) {
        Alert.alert(
          'Schedule Conflicts Detected',
          `${conflictCount} high-severity conflict${conflictCount > 1 ? 's' : ''} found across your recurring sessions. Add anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Anyway', style: 'destructive', onPress: saveRecurringTask },
          ]
        );
        return;
      }

      await saveRecurringTask();
      return;
    }

    if (hasHighConflicts) {
      Alert.alert(
        'Schedule Conflict Detected',
        'This task overlaps with an existing schedule. Do you still want to add it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', style: 'destructive', onPress: saveTask },
        ]
      );
      return;
    }

    await saveTask();
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add New Task</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.label}>Task Title</Text>
        <TextInput style={styles.input} placeholder="Enter task title"
          placeholderTextColor="rgba(255,255,255,0.3)" value={title}
          onChangeText={setTitle} maxLength={100} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Enter task description"
          placeholderTextColor="rgba(255,255,255,0.3)" value={description}
          onChangeText={setDescription} multiline numberOfLines={4} maxLength={500} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.optionRow}>
          {['Academic', 'Organization', 'Personal'].map((cat) => (
            <TouchableOpacity key={cat}
              style={[styles.optionButton, category === cat && styles.optionButtonActive]}
              onPress={() => setCategory(cat)}>
              <Text style={[styles.optionText, category === cat && styles.optionTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.optionRow}>
          {['Low', 'Medium', 'High'].map((pri) => (
            <TouchableOpacity key={pri}
              style={[styles.optionButton, priority === pri && styles.optionButtonActive,
                priority === pri && pri === 'High' && { borderColor: '#ef4444' },
                priority === pri && pri === 'Medium' && { borderColor: '#fb923c' },
                priority === pri && pri === 'Low' && { borderColor: '#34d399' },
              ]}
              onPress={() => setPriority(pri)}>
              <Text style={[styles.optionText, priority === pri && styles.optionTextActive]}>{pri}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* REPEAT TOGGLE */}
        <TouchableOpacity
          style={styles.timeToggleRow}
          onPress={() => setIsRepeat(!isRepeat)}
        >
          <View style={styles.timeToggleLeft}>
            <Ionicons name="repeat-outline" size={18} color="rgba(255,255,255,0.5)" />
            <Text style={styles.timeToggleText}>Repeat weekly</Text>
          </View>
          <View style={[styles.toggleTrack, isRepeat && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, isRepeat && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>

        {/* --- SINGLE TASK: Deadline --- */}
        {!isRepeat && (
          <>
            <Text style={styles.label}>Deadline</Text>
            <TouchableOpacity style={styles.deadlineRow} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.deadlineText}>
                {deadline.toLocaleDateString('en-US', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
                {hasTime ? ` at ${deadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
              </Text>
              <Ionicons name="chevron-down-outline" size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker value={deadline} mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDeadline(selectedDate);
                }} />
            )}

            {/* TIME TOGGLE (single task only) */}
            <TouchableOpacity
              style={styles.timeToggleRow}
              onPress={() => setHasTime(!hasTime)}
            >
              <View style={styles.timeToggleLeft}>
                <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.5)" />
                <Text style={styles.timeToggleText}>Set specific time</Text>
              </View>
              <View style={[styles.toggleTrack, hasTime && styles.toggleTrackActive]}>
                <View style={[styles.toggleThumb, hasTime && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            {hasTime && (
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={18} color="#a78bfa" />
                <Text style={styles.timeText}>
                  {deadline.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </Text>
                <Ionicons name="chevron-down-outline" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}

            {showTimePicker && (
              <DateTimePicker
                value={deadline}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (selectedDate) setDeadline(selectedDate);
                }}
              />
            )}

            {/* CONFLICT ALERTS (single task) */}
            <ConflictAlert conflicts={conflicts} />
          </>
        )}

        {/* --- REPEAT: Day selector + Duration + Per-day times --- */}
        {isRepeat && (
          <>
            <Text style={styles.label}>Repeat On</Text>
            <View style={styles.dayRow}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, selectedDays.includes(day) && styles.dayChipActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayChipText, selectedDays.includes(day) && styles.dayChipTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationRow}>
              {[
                { key: '4weeks', label: '4 Weeks' },
                { key: '8weeks', label: '8 Weeks' },
                { key: '4months', label: '4 Months' },
                { key: 'custom', label: 'Custom' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.durationChip, durationPreset === opt.key && styles.durationChipActive]}
                  onPress={() => setDurationPreset(opt.key)}
                >
                  <Text style={[styles.durationChipText, durationPreset === opt.key && styles.durationChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {durationPreset === 'custom' && (
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="e.g. 6"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="number-pad"
                  value={customValue}
                  onChangeText={setCustomValue}
                  maxLength={3}
                />
                <View style={styles.unitRow}>
                  {['weeks', 'months'].map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitChip, customUnit === u && styles.unitChipActive]}
                      onPress={() => setCustomUnit(u)}
                    >
                      <Text style={[styles.unitChipText, customUnit === u && styles.unitChipTextActive]}>
                        {u.charAt(0).toUpperCase() + u.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* PER-DAY TIME OVERRIDES */}
            {selectedDays.length > 0 && (
              <>
                <Text style={styles.label}>Time Per Day</Text>
                {selectedDays.map((day) => {
                  const times = getDayTime(day);
                  return (
                    <View key={day} style={styles.dayTimeRow}>
                      <Text style={styles.dayTimeLabel}>{day}</Text>
                      <TouchableOpacity
                        style={styles.dayTimeButton}
                        onPress={() => { setEditingDay(day); setEditingField('start'); }}
                      >
                        <Text style={styles.dayTimeText}>{formatTime(times.startHour, times.startMinute)}</Text>
                      </TouchableOpacity>
                      <Text style={styles.dayTimeSeparator}>to</Text>
                      <TouchableOpacity
                        style={styles.dayTimeButton}
                        onPress={() => { setEditingDay(day); setEditingField('end'); }}
                      >
                        <Text style={styles.dayTimeText}>{formatTime(times.endHour, times.endMinute)}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            {/* Day time picker */}
            {editingDay && (
              <DateTimePicker
                value={getPickerValue()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDayTimeChange}
              />
            )}

            {/* Session preview */}
            {selectedDays.length > 0 && (
              <View style={styles.sessionPreview}>
                <Ionicons name="information-circle-outline" size={16} color="#a78bfa" />
                <Text style={styles.sessionPreviewText}>
                  This will create {sessionCount} sessions ({selectedDays.join(', ')}) over {getDurationWeeks()} weeks
                </Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit} disabled={isLoading}>
          <Text style={styles.submitButtonText}>
            {isLoading
              ? 'Saving...'
              : isRepeat
                ? `Add Task (${sessionCount} sessions)`
                : 'Add Task'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 600, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, marginBottom: 28 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 15, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  textArea: { height: 100, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  optionButton: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: '#1a1a3e' },
  optionButtonActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.15)' },
  optionText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  optionTextActive: { color: '#ffffff', fontWeight: '700' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'space-between' },
  deadlineText: { color: '#ffffff', fontSize: 14 },
  submitButton: { backgroundColor: '#7c3aed', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  timeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  timeToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeToggleText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackActive: { backgroundColor: 'rgba(167,139,250,0.4)' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.4)' },
  toggleThumbActive: { backgroundColor: '#a78bfa', alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', justifyContent: 'space-between' },
  timeText: { color: '#a78bfa', fontSize: 16, fontWeight: '600', flex: 1 },

  // Repeat — day selector
  dayRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  dayChip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1a1a3e',
  },
  dayChipActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.2)' },
  dayChipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  dayChipTextActive: { color: '#ffffff', fontWeight: '700' },

  // Repeat — duration
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  durationChip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1a1a3e',
  },
  durationChipActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.2)' },
  durationChipText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  durationChipTextActive: { color: '#ffffff', fontWeight: '700' },

  // Repeat — custom duration
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  customInput: {
    backgroundColor: '#1a1a3e', borderRadius: 10, padding: 12, color: '#ffffff',
    fontSize: 15, width: 80, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitChip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1a1a3e',
  },
  unitChipActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.2)' },
  unitChipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  unitChipTextActive: { color: '#ffffff', fontWeight: '700' },

  // Repeat — per-day time overrides
  dayTimeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1a3e', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  dayTimeLabel: { color: '#ffffff', fontWeight: '600', fontSize: 14, width: 40 },
  dayTimeButton: {
    backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  dayTimeText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },
  dayTimeSeparator: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },

  // Repeat — session preview
  sessionPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 10,
    padding: 12, marginTop: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  sessionPreviewText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1 },
});