import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { addClassSchedule } from '../services/taskService';
import { detectConflicts } from '../services/conflictService';
import { createNotification } from '../services/notificationService';
import { useTasks } from '../hooks/useTasks';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext'; // for dark mode
import {
  WEEKDAY_NAMES,
  toWeekdayNumbers,
  startOfDay,
  addDuration,
  getMaxEndDate,
  getSessionDates,
} from '../utils/scheduleUtils';


const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Shortcuts that fill in the end date, counted from the start date.
const DURATION_PRESETS = [
  { label: '4 weeks', value: 4, unit: 'weeks' },
  { label: '8 weeks', value: 8, unit: 'weeks' },
  { label: '4 months', value: 4, unit: 'months' },
];

const formatDate = (date) =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export default function AddClassScreen({ navigation }) {
  const { tasks: existingTasks } = useTasks();
  const [className, setClassName] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const { theme, isDarkMode } = useTheme(); // for dark mode
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(10, 30, 0, 0);
    return d;
  });
  const [category, setCategory] = useState('Academic');
  const [isLoading, setIsLoading] = useState(false);
  // Per-day time overrides — e.g. { Monday: { start: Date, end: Date } }
  const [dayTimeOverrides, setDayTimeOverrides] = useState({});
  const [editingDay, setEditingDay] = useState(null);   // null | 'default' | 'Monday' etc.
  const [editingField, setEditingField] = useState(null); // null | 'start' | 'end'

  // Schedule dates. Starts today unless the user picks a later day; the end
  // date is picked from the calendar or filled in by a preset.
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [endDate, setEndDate] = useState(null);
  const [activePreset, setActivePreset] = useState(null); // preset that set endDate
  const [datePicker, setDatePicker] = useState(null); // null | 'start' | 'end'

  const toggleDay = (day) => {
    const removing = selectedDays.includes(day);
    setSelectedDays((prev) =>
      removing ? prev.filter((d) => d !== day) : [...prev, day]
    );
    if (removing) {
      setDayTimeOverrides((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
    }
  };
    const getDayTime = (day) => {
    const override = dayTimeOverrides[day];
    return {
      start: override?.start || startTime,
      end: override?.end || endTime,
      isCustom: !!override,
    };
  };

  const getPickerValue = () => {
    if (editingDay === 'default') {
      return editingField === 'start' ? startTime : endTime;
    }
    if (editingDay) {
      const override = dayTimeOverrides[editingDay];
      if (editingField === 'start') return override?.start || startTime;
      return override?.end || endTime;
    }
    return startTime;
  };

  const handlePickerChange = (event, selectedDate) => {
    if (!selectedDate) {
      setEditingDay(null);
      setEditingField(null);
      return;
    }

    if (editingDay === 'default') {
      if (editingField === 'start') setStartTime(selectedDate);
      else setEndTime(selectedDate);
    } else if (editingDay) {
      setDayTimeOverrides((prev) => ({
        ...prev,
        [editingDay]: {
          start: prev[editingDay]?.start || startTime,
          end: prev[editingDay]?.end || endTime,
          [editingField]: selectedDate,
        },
      }));
    }

    setEditingDay(null);
    setEditingField(null);
  };

  const choosePreset = (preset) => {
    setEndDate(addDuration(startDate, preset.value, preset.unit));
    setActivePreset(preset);
  };

  const handleDateChange = (event, selectedDate) => {
    const which = datePicker;
    setDatePicker(null);
    if (event?.type === 'dismissed' || !selectedDate) return;
    const picked = startOfDay(selectedDate);

    if (which === 'start') {
      setStartDate(picked);
      // Keep the end date valid for the new start: a preset follows the
      // start date; a hand-picked end date is cleared if it no longer fits.
      if (activePreset) {
        setEndDate(addDuration(picked, activePreset.value, activePreset.unit));
      } else if (endDate && (endDate < picked || endDate > getMaxEndDate(picked))) {
        setEndDate(null);
      }
    } else {
      setEndDate(picked);
      setActivePreset(null);
    }
  };

  // Same rule addClassSchedule uses when saving
  const getSessionDays = () => getSessionDates(startDate, endDate, toWeekdayNumbers(selectedDays));

  const buildSessionTasks = () => {
    const sessions = [];
    for (const cursor of getSessionDays()) {
      const dayName = WEEKDAY_NAMES[cursor.getDay()];
      const dt = getDayTime(dayName);
      const taskDate = new Date(cursor);
      taskDate.setHours(dt.start.getHours(), dt.start.getMinutes(), 0, 0);
      // Without endTime the conflict check assumes 60 minutes, missing
      // overlaps in the rest of a longer class.
      const sessionEnd = new Date(cursor);
      sessionEnd.setHours(dt.end.getHours(), dt.end.getMinutes(), 0, 0);

      sessions.push({
        title: className.trim(),
        category,
        priority: 'Medium',
        deadline: taskDate.toISOString(),
        endTime: sessionEnd.toISOString(),
      });
    }
    return sessions;
  };

  const [conflictSummary, setConflictSummary] = useState({ total: 0, high: 0, sessions: 0 });

  const saveSchedule = async () => {
    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;

      const dayTimes = {};
      for (const day of selectedDays) {
        const dt = getDayTime(day);
        dayTimes[day] = {
          startHour: dt.start.getHours(),
          startMinute: dt.start.getMinutes(),
          endHour: dt.end.getHours(),
          endMinute: dt.end.getMinutes(),
        };
      }

      const scheduleData = {
        userId: currentUser.uid,
        ownerEmail: (currentUser.email || '').toLowerCase(),
        ownerName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
        className: className.trim(),
        category,
        days: selectedDays,
        dayTimes,
        startDate,
        endDate,
      };

      const count = await addClassSchedule(scheduleData);

      if (count > 0 && conflictSummary.total > 0) {
        await createNotification(
          currentUser.uid,
          `"${className.trim()}" created with ${conflictSummary.total} scheduling conflict${conflictSummary.total > 1 ? 's' : ''} across ${count} sessions.`,
          'conflict'
        );
      }

      Alert.alert(
        'Schedule Created',
        `"${className.trim()}" has been added — ${count} sessions created across your calendar.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!className.trim()) {
      Alert.alert('Error', 'Please enter a class or activity name');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day');
      return;
    }
    if (!endDate) {
      Alert.alert('Error', 'Please choose when the class ends');
      return;
    }
    if (startTime >= endTime) {
      Alert.alert('Error', 'Default end time must be after start time');
      return;
    }
    for (const day of selectedDays) {
      const override = dayTimeOverrides[day];
      if (override && override.start >= override.end) {
        Alert.alert('Error', `End time must be after start time for ${day}`);
        return;
      }
    }

    const sessions = buildSessionTasks();
    if (sessions.length === 0) {
      Alert.alert('No sessions', 'None of the selected days fall between the start and end dates. Pick different dates or days.');
      return;
    }
    let conflictSessionCount = 0;
    let highConflictCount = 0;
    let totalConflicts = 0;

    for (const session of sessions) {
      const conflicts = detectConflicts(session, existingTasks);
      if (conflicts.length > 0) {
        conflictSessionCount++;
        totalConflicts += conflicts.length;
        if (conflicts.some((c) => c.severity === 'high')) highConflictCount++;
      }
    }

    setConflictSummary({ total: totalConflicts, high: highConflictCount, sessions: conflictSessionCount });

    if (conflictSessionCount > 0) {
      Alert.alert(
        'Schedule Conflicts Detected',
        `${conflictSessionCount} of ${sessions.length} sessions conflict with existing tasks${highConflictCount > 0 ? ` (${highConflictCount} direct time overlaps)` : ''}.\n\nCreate anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Anyway', style: 'destructive', onPress: saveSchedule },
        ]
      );
      return;
    }

    await saveSchedule();
  };

  const sessionCount = useMemo(
    () => getSessionDates(startDate, endDate, toWeekdayNumbers(selectedDays)).length,
    [selectedDays, startDate, endDate]
  );

  const today = startOfDay(new Date());
  const startsToday = startDate.getTime() === today.getTime();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { 
            backgroundColor: theme.card, 
            borderColor: theme.border, 
            borderWidth: 1,}
            ,]} 
          onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={ theme.text } />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Add Class Schedule</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* CLASS NAME */}
        <Text style={[styles.label, { color: theme.text }]}>Class / Activity Name</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.card,
            color: theme.text,
            borderColor: theme.border

          }]}
          placeholder='e.g. "Math 101" or "Gym"'
          placeholderTextColor= {theme.subtext}
          value={className}
          onChangeText={setClassName}
          maxLength={100}
        />

        {/* CATEGORY */}
        <Text style={[styles.label, { color: theme.text }]}>Category</Text>
        <View style={styles.optionRow}>
          {['Academic', 'Organization', 'Personal'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.optionButton, { 
                backgroundColor: theme.card, 
                borderColor: theme.border 
              }, category === cat && styles.optionButtonActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.optionText, { color: category === cat ? theme.text : theme.subtext}, 
                category === cat && {color: theme.text, fontWeight: '700',},]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* DAY SELECTOR */}
        <Text style={[styles.label, { color: theme.text }]}>Repeat on</Text>
        <View style={styles.dayRow}>
          {WEEKDAYS.map((day, i) => {
            const isSelected = selectedDays.includes(day);
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayChip, { 
                  backgroundColor: theme.card,
                  borderColor: theme.border
                }, isSelected && styles.dayChipActive]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.dayChipText, { color: isSelected ? theme.text : theme.subtext}, isSelected && {color: theme.text, fontWeight: '700',},]}>
                  {WEEKDAY_SHORT[i]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* DEFAULT TIME */}
        <Text style={[styles.label, { color: theme.text }]}>Default Time</Text>
        <View style={styles.timeRangeRow}>
          <TouchableOpacity
            style={[styles.timeBox, {
              backgroundColor: theme.card,
              borderColor: theme.border,
            }]}
            onPress={() => { setEditingDay('default'); setEditingField('start'); }}
          >
            <Ionicons name="time-outline" size={16} color={theme.accent} />
            <Text style={[styles.timeBoxText, { color: theme.text }]}>
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.timeDash, { color: theme.subtext }]}>—</Text>

          <TouchableOpacity
            style={[styles.timeBox, {
              backgroundColor: theme.card,
              borderColor: theme.border
            }]}
            onPress={() => { setEditingDay('default'); setEditingField('end'); }}
          >
            <Ionicons name="time-outline" size={16} color={ theme.accent } />
            <Text style={[styles.timeBoxText, { color: theme.text }]}>
              {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PER-DAY SCHEDULE */}
        {selectedDays.length > 0 && (
          <>
            <Text style={[styles.label, { color: theme.text }]}>Per-Day Schedule</Text>
            <Text style={[styles.perDayHint, { color: theme.subtext }]}>Tap a time to customize that day</Text>
            {selectedDays.map((day) => {
              const dt = getDayTime(day);
              return (
                <View key={day} style={[styles.dayScheduleRow, { backgroundColor: theme.card, borderColor: theme.border}]}>
                  <Text style={[styles.dayScheduleName, { color: theme.text }]}>{day}</Text>
                  <View style={styles.dayScheduleTimes}>
                    <TouchableOpacity
                      onPress={() => { setEditingDay(day); setEditingField('start'); }}
                    >
                      <Text style={[styles.dayScheduleTime, { color: theme.text }, dt.isCustom && { color: theme.accent},]}>
                        {dt.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.dayScheduleDash, { color: theme.subtext }]}>—</Text>
                    <TouchableOpacity
                      onPress={() => { setEditingDay(day); setEditingField('end'); }}
                    >
                      <Text style={[styles.dayScheduleTime, { color: theme.text }, dt.isCustom && { color: theme.accent }]}>
                        {dt.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Text>
                    </TouchableOpacity>
                    {dt.isCustom && (
                      <TouchableOpacity
                        onPress={() => {
                          setDayTimeOverrides((prev) => {
                            const next = { ...prev };
                            delete next[day];
                            return next;
                          });
                        }}
                        style={styles.resetButton}
                      >
                        <Ionicons name="close-circle" size={16} color={ theme.subtext } />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* UNIFIED TIME PICKER */}
        {editingDay !== null && (
          <DateTimePicker
            value={getPickerValue()}
            mode="time"
            themeVariant={isDarkMode ? 'dark' : 'light'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handlePickerChange}
          />
        )}

        {/* START DATE */}
        <Text style={[styles.label, { color: theme.text }]}>Starts on</Text>
        <TouchableOpacity
          style={[styles.dateBox, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => setDatePicker('start')}
        >
          <Ionicons name="calendar-outline" size={18} color={theme.accent} />
          <Text style={[styles.dateBoxText, { color: theme.text }]}>
            {startsToday ? `Today, ${formatDate(startDate)}` : formatDate(startDate)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.subtext} />
        </TouchableOpacity>

        {/* END DATE */}
        <Text style={[styles.label, { color: theme.text }]}>Repeats until</Text>
        <TouchableOpacity
          style={[styles.dateBox, { backgroundColor: theme.card, borderColor: endDate ? theme.accent : theme.border }]}
          onPress={() => setDatePicker('end')}
        >
          <Ionicons name="calendar-outline" size={18} color={theme.accent} />
          <Text style={[styles.dateBoxText, { color: endDate ? theme.text : theme.subtext }]}>
            {endDate ? formatDate(endDate) : 'Pick an end date'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.subtext} />
        </TouchableOpacity>

        <Text style={[styles.perDayHint, { color: theme.subtext }]}>Or use a shortcut (counted from the start date):</Text>
        <View style={styles.durationRow}>
          {DURATION_PRESETS.map((preset) => {
            const isActive = activePreset?.label === preset.label;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.durationChip, { backgroundColor: theme.card, borderColor: theme.border }, isActive && styles.durationChipActive]}
                onPress={() => choosePreset(preset)}
              >
                <Text style={[styles.durationChipText, { color: isActive ? theme.text : theme.subtext }, isActive && { color: theme.text, fontWeight: '700',},]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* DATE PICKER (start or end) */}
        {datePicker !== null && (
          <DateTimePicker
            value={datePicker === 'start' ? startDate : (endDate || addDuration(startDate, 4, 'weeks'))}
            mode="date"
            minimumDate={datePicker === 'start' ? today : startDate}
            maximumDate={datePicker === 'start' ? getMaxEndDate(today) : getMaxEndDate(startDate)}
            themeVariant={isDarkMode ? 'dark' : 'light'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}

        {/* PREVIEW */}
        {sessionCount > 0 && endDate && (
          <View style={styles.previewBox}>
            <Ionicons name="calendar-outline" size={16} color={ theme.subtext } />
            <Text style={[styles.previewText, { color: theme.subtext }]}>
              {sessionCount} session{sessionCount !== 1 ? 's' : ''} will be created
              {' '}({selectedDays.map((d) => d.slice(0, 3)).join(', ')}, {startsToday ? 'today' : formatDate(startDate)} to {formatDate(endDate)})
            </Text>
          </View>
        )}

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.submitButtonText}>
            {isLoading ? 'Creating...' : `Create Schedule${sessionCount > 0 ? ` (${sessionCount} sessions)` : ''}`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  dateBoxText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#0f0f23' 
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 40 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 20, marginBottom: 28 
  },
  backButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#ffffff' 
  },
  label: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: 'rgba(255,255,255,0.6)', 
    marginBottom: 8, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  input: { 
    backgroundColor: '#1a1a3e', 
    borderRadius: 12, 
    padding: 14, 
    color: '#ffffff', 
    fontSize: 15, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)' 
  },
  optionRow: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 20 
  },
  optionButton: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.15)', 
    alignItems: 'center', 
    backgroundColor: '#1a1a3e' 
  },
  optionButtonActive: { 
    borderColor: '#a78bfa', 
    backgroundColor: 'rgba(167,139,250,0.15)' 
  },
  optionText: { 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.5)', 
    fontWeight: '500' 
  },
  optionTextActive: { 
    color: '#ffffff', 
    fontWeight: '700' 
  },

  dayRow: { 
    flexDirection: 'row', 
    gap: 6, 
    marginBottom: 20, 
    flexWrap: 'wrap' 
  },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a3e',
  },
  dayChipActive: { 
    borderColor: '#a78bfa', 
    backgroundColor: 'rgba(167,139,250,0.2)' 
  },
  dayChipText: { 
    fontSize: 13, 
    fontWeight: '500', 
    color: 'rgba(255,255,255,0.5)' 
  },
  dayChipTextActive: { 
    color: '#ffffff', 
    fontWeight: '700' 
  },
  timeRangeRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 20 
  },
  timeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a3e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  timeBoxText: { 
    color: '#a78bfa', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  timeDash: { 
    color: 'rgba(255,255,255,0.3)', 
    fontSize: 18 
  },
  durationRow: { 
    flexDirection: 'row', 
    gap: 8, 
    marginBottom: 12, 
    flexWrap: 'wrap' 
  },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a3e',
  },
  durationChipActive: { 
    borderColor: '#a78bfa', 
    backgroundColor: 'rgba(167,139,250,0.2)' 
  },
  durationChipText: { 
    fontSize: 13, 
    fontWeight: '500', 
    color: 'rgba(255,255,255,0.5)' 
  },
  durationChipTextActive: { 
    color: '#ffffff', 
    fontWeight: '700' 
  },
  customRow: { flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 20 
  },
  customInput: {
    width: 70,
    backgroundColor: '#1a1a3e',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  unitRow: { 
    flexDirection: 'row', 
    gap: 8 
  },
  unitChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a3e',
  },
  unitChipActive: { 
    borderColor: '#a78bfa', 
    backgroundColor: 'rgba(167,139,250,0.2)' 
  },
  unitChipText: { 
    fontSize: 13, 
    fontWeight: '500', 
    color: 'rgba(255,255,255,0.5)' 
  },
  unitChipTextActive: { 
    color: '#ffffff', 
    fontWeight: '700' 
  },
  perDayHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 10,
    marginTop: -4,
  },
  dayScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a3e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayScheduleRowCustom: {
    borderColor: 'rgba(167,139,250,0.25)',
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  dayScheduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    width: 90,
  },
  dayScheduleTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayScheduleTime: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dayScheduleTimeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayScheduleTimeCustom: {
    color: '#a78bfa',
    backgroundColor: 'rgba(167,139,250,0.12)',
    fontWeight: '700',
  },
  dayScheduleDash: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 14,
  },
  resetButton: {
    marginLeft: 4,
    padding: 2,
  },

  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  previewText: { 
    fontSize: 13, 
    color: '#a78bfa', 
    flex: 1, 
    lineHeight: 18 
  },
  submitButton: { 
    backgroundColor: '#7c3aed', 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  submitButtonDisabled: { 
    opacity: 0.6 
  },
  submitButtonText: { 
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: '700' 
  },
});