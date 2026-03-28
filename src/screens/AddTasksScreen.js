import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { addTask } from '../services/taskService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';
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


  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Please enter a task title'); return; }
    if (!description.trim()) { Alert.alert('Error', 'Please enter a task description'); return; }

    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      const taskData = {
        userId: currentUser.uid,
        title: title.trim(),
        description: description.trim(),
        category: category,
        priority: priority,
        deadline: hasTime ? deadline.toISOString() : deadline.toISOString().split('T')[0],
        priorityScore: 0,
        assignments: [],
      };
      const score = computePriorityScore(taskData);
      taskData.priorityScore = score;
      taskData.priorityLabel = getPriorityLabel(score);

      const taskId = await addTask(taskData);
      if (taskId) {
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
  }

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

        {/* TIME DISPLAY & PICKER */}
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

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit} disabled={isLoading}>
          <Text style={styles.submitButtonText}>{isLoading ? 'Saving...' : 'Add Task'}</Text>
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
  textArea: { height: 100, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  optionButton: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: '#1a1a3e' },
  optionButtonActive: { borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.15)' },
  optionText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  optionTextActive: { color: '#ffffff', fontWeight: '700' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, marginBottom: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'space-between' },
  deadlineText: { color: '#ffffff', fontSize: 14 },
  submitButton: { backgroundColor: '#7c3aed', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

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
