import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { updateTask } from '../services/taskService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';
import { checkAndNotifyConflicts } from '../services/conflictService';
import { useTaskConflicts } from '../hooks/useConflicts';
import { useTasks } from '../hooks/useTasks';
import ConflictAlert from '../components/ConflictAlert';
import DateTimePicker from '@react-native-community/datetimepicker';


export default function EditTaskScreen({ route, navigation }) {
  const { task } = route.params;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState(task.priority);
  const [deadline, setDeadline] = useState(new Date(task.deadline));
  const [progress, setProgress] = useState(task.progress || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasTime, setHasTime] = useState(task.deadline && task.deadline.includes('T'));
  const [showTimePicker, setShowTimePicker] = useState(false);

  const { tasks: existingTasks } = useTasks();

  // Build a temporary task object for live conflict checking
  const pendingTask = useMemo(() => ({
    id: task.id,
    title: title.trim(),
    category,
    priority,
    deadline: hasTime ? deadline.toISOString() : deadline.toISOString().split('T')[0],
  }), [category, priority, deadline, hasTime]);

  const { conflicts, hasHighConflicts } = useTaskConflicts(pendingTask, existingTasks);

  const handleApplySuggestion = (slot) => {
    if (slot.type === 'time') {
      setDeadline(new Date(slot.value));
      setHasTime(true);
    } else if (slot.type === 'date') {
      const [year, month, day] = slot.value.split('-').map(Number);
      const newDate = new Date(deadline);
      newDate.setFullYear(year, month - 1, day);
      setDeadline(newDate);
    }
  };



  const progressOptions = [
    { value: 0, label: 'To Do' },
    { value: 50, label: 'In Progress' },
    { value: 100, label: 'Done' },
  ];

    const saveChanges = async () => {
    setIsLoading(true);
    try {
      const updatedData = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        deadline: hasTime ? deadline.toISOString() : deadline.toISOString().split('T')[0],
        progress,
        isCompleted: progress === 100,
      };

      const score = computePriorityScore(updatedData);
      updatedData.priorityScore = score;
      updatedData.priorityLabel = getPriorityLabel(score);

      const success = await updateTask(task.id, updatedData);

      if (success) {
        updatedData.id = task.id;
        updatedData.userId = task.userId;
        await checkAndNotifyConflicts(task.userId, updatedData, existingTasks);

        Alert.alert(
          'Task Updated',
          `"${title}" has been updated. Priority score: ${score}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', 'Failed to update task. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a task description');
      return;
    }

    if (hasHighConflicts) {
      Alert.alert(
        'Schedule Conflict Detected',
        'This task overlaps with an existing schedule. Do you still want to save?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', style: 'destructive', onPress: saveChanges },
        ]
      );
      return;
    }

    await saveChanges();
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Task</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* TITLE INPUT */}
        <Text style={styles.label}>Task Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter task title"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* DESCRIPTION INPUT */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter task description"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={500}
        />

        {/* CATEGORY SELECTOR */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.optionRow}>
          {['Academic', 'Organization', 'Personal'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.optionButton,
                category === cat && styles.optionButtonActive,
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[
                styles.optionText,
                category === cat && styles.optionTextActive,
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* PRIORITY SELECTOR */}
        <Text style={styles.label}>Priority</Text>
        <View style={styles.optionRow}>
          {['Low', 'Medium', 'High'].map((pri) => (
            <TouchableOpacity
              key={pri}
              style={[
                styles.optionButton,
                priority === pri && styles.optionButtonActive,
                priority === pri && pri === 'High' && { borderColor: '#ef4444' },
                priority === pri && pri === 'Medium' && { borderColor: '#fb923c' },
                priority === pri && pri === 'Low' && { borderColor: '#34d399' },
              ]}
              onPress={() => setPriority(pri)}
            >
              <Text style={[
                styles.optionText,
                priority === pri && styles.optionTextActive,
              ]}>
                {pri}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* DEADLINE */}
        <Text style={styles.label}>Deadline</Text>
        <TouchableOpacity
          style={styles.deadlineRow}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.5)" />
          <Text style={styles.deadlineText}>
            {deadline.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {hasTime ? ` at ${deadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
          </Text>
          <Ionicons name="chevron-down-outline" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

                {showDatePicker && (
          <DateTimePicker
            value={deadline}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setDeadline(selectedDate);
              }
            }}
          />
        )}

        {/* TIME TOGGLE */}
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

                {/* STATUS SELECTOR */}
        <Text style={styles.label}>Status</Text>
        <View style={styles.progressRow}>
          {progressOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.progressChip,
                progress === opt.value && styles.progressChipActive,
              ]}
              onPress={() => setProgress(opt.value)}
            >
              <Text style={[
                styles.progressChipText,
                progress === opt.value && styles.progressChipTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>


        {/* Progress Bar Preview */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>

                {/* CONFLICT ALERTS */}
        <ConflictAlert conflicts={conflicts} onApplySuggestion={handleApplySuggestion} />        <ConflictAlert conflicts={conflicts} onApplySuggestion={handleApplySuggestion} />

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.submitButtonText}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 40,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    marginBottom: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1a1a3e',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    backgroundColor: '#1a1a3e',
  },
  optionButtonActive: {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(167,139,250,0.15)',
  },
  optionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a3e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'space-between',
  },
  deadlineText: {
    color: '#ffffff',
    fontSize: 14,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  progressChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    backgroundColor: '#1a1a3e',
  },
  progressChipActive: {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(167,139,250,0.15)',
  },
  progressChipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  progressChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 28,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#a78bfa',
    borderRadius: 3,
  },
  submitButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  timeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  timeToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeToggleText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackActive: { backgroundColor: 'rgba(167,139,250,0.4)' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.4)' },
  toggleThumbActive: { backgroundColor: '#a78bfa', alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, marginBottom: 28, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', justifyContent: 'space-between' },
  timeText: { color: '#a78bfa', fontSize: 16, fontWeight: '600', flex: 1 },

});
