import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { addClassSchedule } from '../services/taskService';
import DateTimePicker from '@react-native-community/datetimepicker';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DURATION_PRESETS = [
  { label: '4 weeks', value: 4, unit: 'weeks' },
  { label: '8 weeks', value: 8, unit: 'weeks' },
  { label: '4 months', value: 4, unit: 'months' },
];

export default function AddClassScreen({ navigation }) {
  const [className, setClassName] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
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
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [category, setCategory] = useState('Academic');
  const [isLoading, setIsLoading] = useState(false);

  // Duration state
  const [durationPreset, setDurationPreset] = useState(null);
  const [customValue, setCustomValue] = useState('8');
  const [customUnit, setCustomUnit] = useState('weeks');
  const [showCustom, setShowCustom] = useState(false);

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const getDuration = () => {
    if (durationPreset) return durationPreset;
    if (showCustom && customValue) {
      return { value: parseInt(customValue, 10) || 4, unit: customUnit };
    }
    return null;
  };

  const getEndDate = () => {
    const dur = getDuration();
    if (!dur) return null;
    const end = new Date();
    if (dur.unit === 'weeks') {
      end.setDate(end.getDate() + dur.value * 7);
    } else {
      end.setMonth(end.getMonth() + dur.value);
    }
    return end;
  };

  const countSessions = () => {
    const endDate = getEndDate();
    if (!endDate || selectedDays.length === 0) return 0;

    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= endDate) {
      const dayName = WEEKDAYS[cursor.getDay() === 0 ? 6 : cursor.getDay() - 1];
      if (selectedDays.includes(dayName)) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
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
    if (!getDuration()) {
      Alert.alert('Error', 'Please select a duration');
      return;
    }
    if (startTime >= endTime) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }

    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      const dur = getDuration();
      const endDate = getEndDate();

      const scheduleData = {
        userId: currentUser.uid,
        ownerEmail: (currentUser.email || '').toLowerCase(),
        ownerName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
        className: className.trim(),
        category,
        days: selectedDays,
        startHour: startTime.getHours(),
        startMinute: startTime.getMinutes(),
        endHour: endTime.getHours(),
        endMinute: endTime.getMinutes(),
        endDate,
        duration: { value: dur.value, unit: dur.unit },
      };

      const count = await addClassSchedule(scheduleData);

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

  const sessionCount = countSessions();
  const dur = getDuration();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Class Schedule</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* CLASS NAME */}
        <Text style={styles.label}>Class / Activity Name</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. "Math 101" or "Gym"'
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={className}
          onChangeText={setClassName}
          maxLength={100}
        />

        {/* CATEGORY */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.optionRow}>
          {['Academic', 'Organization', 'Personal'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.optionButton, category === cat && styles.optionButtonActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.optionText, category === cat && styles.optionTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* DAY SELECTOR */}
        <Text style={styles.label}>Repeat on</Text>
        <View style={styles.dayRow}>
          {WEEKDAYS.map((day, i) => {
            const isSelected = selectedDays.includes(day);
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayChip, isSelected && styles.dayChipActive]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                  {WEEKDAY_SHORT[i]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TIME RANGE */}
        <Text style={styles.label}>Time</Text>
        <View style={styles.timeRangeRow}>
          <TouchableOpacity style={styles.timeBox} onPress={() => setShowStartPicker(true)}>
            <Ionicons name="time-outline" size={16} color="#a78bfa" />
            <Text style={styles.timeBoxText}>
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </TouchableOpacity>

          <Text style={styles.timeDash}>—</Text>

          <TouchableOpacity style={styles.timeBox} onPress={() => setShowEndPicker(true)}>
            <Ionicons name="time-outline" size={16} color="#a78bfa" />
            <Text style={styles.timeBoxText}>
              {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </TouchableOpacity>
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => {
              setShowStartPicker(false);
              if (d) setStartTime(d);
            }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => {
              setShowEndPicker(false);
              if (d) setEndTime(d);
            }}
          />
        )}

        {/* DURATION */}
        <Text style={styles.label}>Duration</Text>
        <View style={styles.durationRow}>
          {DURATION_PRESETS.map((preset) => {
            const isActive = durationPreset?.value === preset.value && durationPreset?.unit === preset.unit && !showCustom;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.durationChip, isActive && styles.durationChipActive]}
                onPress={() => {
                  setDurationPreset(preset);
                  setShowCustom(false);
                }}
              >
                <Text style={[styles.durationChipText, isActive && styles.durationChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.durationChip, showCustom && styles.durationChipActive]}
            onPress={() => {
              setShowCustom(true);
              setDurationPreset(null);
            }}
          >
            <Text style={[styles.durationChipText, showCustom && styles.durationChipTextActive]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* CUSTOM DURATION INPUT */}
        {showCustom && (
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              value={customValue}
              onChangeText={setCustomValue}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="8"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <View style={styles.unitRow}>
              <TouchableOpacity
                style={[styles.unitChip, customUnit === 'weeks' && styles.unitChipActive]}
                onPress={() => setCustomUnit('weeks')}
              >
                <Text style={[styles.unitChipText, customUnit === 'weeks' && styles.unitChipTextActive]}>
                  Weeks
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitChip, customUnit === 'months' && styles.unitChipActive]}
                onPress={() => setCustomUnit('months')}
              >
                <Text style={[styles.unitChipText, customUnit === 'months' && styles.unitChipTextActive]}>
                  Months
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PREVIEW */}
        {sessionCount > 0 && dur && (
          <View style={styles.previewBox}>
            <Ionicons name="calendar-outline" size={16} color="#a78bfa" />
            <Text style={styles.previewText}>
              {sessionCount} session{sessionCount !== 1 ? 's' : ''} will be created
              {' '}({selectedDays.map((d) => d.slice(0, 3)).join(', ')} for {dur.value} {dur.unit})
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
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, marginBottom: 28 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 15, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  optionButton: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: '#1a1a3e' },
  optionButtonActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.15)' },
  optionText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  optionTextActive: { color: '#ffffff', fontWeight: '700' },

  dayRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a3e',
  },
  dayChipActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.2)' },
  dayChipText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  dayChipTextActive: { color: '#ffffff', fontWeight: '700' },

  timeRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
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
  timeBoxText: { color: '#a78bfa', fontSize: 15, fontWeight: '600' },
  timeDash: { color: 'rgba(255,255,255,0.3)', fontSize: 18 },

  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a3e',
  },
  durationChipActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.2)' },
  durationChipText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  durationChipTextActive: { color: '#ffffff', fontWeight: '700' },

  customRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  customInput: {
    width: 60,
    backgroundColor: '#1a1a3e',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a3e',
  },
  unitChipActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.2)' },
  unitChipText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  unitChipTextActive: { color: '#ffffff', fontWeight: '700' },

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
  previewText: { fontSize: 13, color: '#a78bfa', flex: 1, lineHeight: 18 },

  submitButton: { backgroundColor: '#7c3aed', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});