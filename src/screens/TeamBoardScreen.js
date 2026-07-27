import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTeamBoard } from '../hooks/useTeams';
import { useTheme } from '../context/ThemeContext'; // for dark mode

const COLUMN_WIDTH = Dimensions.get('window').width * 0.78;

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: '#94a3b8' },
  { key: 'in-progress', label: 'In Progress', color: '#fb923c' },
  { key: 'done', label: 'Done', color: '#34d399' },
];

const DEADLINE_PRESETS = [
  { label: 'None', days: null },
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
];

const toISODate = (days) => {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatDeadline = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function TeamBoardScreen({ route, navigation }) {
  const { teamId, teamName } = route.params;
  const {
    team,
    columns,
    loading,
    isOwner,
    actor,
    addMemberByEmail,
    addTask,
    updateProgress,
    assign,
    removeTask,
    removeTeam,
    refetch,
  } = useTeamBoard(teamId);

  // Modals
  const [taskModal, setTaskModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [assignModal, setAssignModal] = useState(null); // holds the task being reassigned

  // Add-task form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineDays, setDeadlineDays] = useState(null);
  const [assignee, setAssignee] = useState(null); // { uid, name }
  const [saving, setSaving] = useState(false);

  // Add-member form
  const [memberEmail, setMemberEmail] = useState('');

  const { theme } = useTheme(); // for dark mode

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const canModify = (task) =>
    isOwner || task.assigneeId === actor?.uid || task.assignedById === actor?.uid;

  const resetTaskForm = () => {
    setTitle('');
    setDescription('');
    setDeadlineDays(null);
    setAssignee(null);
  };

  const handleAddTask = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    setSaving(true);
    await addTask({
      title: title.trim(),
      description: description.trim(),
      deadline: toISODate(deadlineDays),
      assigneeId: assignee?.uid || null,
      assigneeName: assignee?.name || null,
    });
    setSaving(false);
    resetTaskForm();
    setTaskModal(false);
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) {
      Alert.alert('Email required', 'Enter the teammate’s email.');
      return;
    }
    setSaving(true);
    const res = await addMemberByEmail(memberEmail.trim());
    setSaving(false);
    if (res.success) {
      setMemberEmail('');
      setMemberModal(false);
      Alert.alert('Member added', 'Your teammate now has access to this board.');
    } else {
      const messages = {
        'not-found': 'No BALANSE user found with that email. They need to sign up first.',
        'already-member': 'That person is already on this team.',
        self: 'You’re already on this team.',
        invalid: 'Please enter a valid email.',
        error: 'Something went wrong. Please try again.',
      };
      Alert.alert('Could not add', messages[res.reason] || messages.error);
    }
  };

  const handleProgress = async (task, delta) => {
    const next = Math.max(0, Math.min(100, task.progress + delta));
    await updateProgress(task, next);
  };

  const handleMarkDone = async (task) => {
    await updateProgress(task, 100);
  };

  const handleAssign = async (member) => {
    if (assignModal) {
      await assign(assignModal, { uid: member.uid, name: member.name });
      setAssignModal(null);
    }
  };

  const confirmDeleteTask = (task) => {
    Alert.alert('Delete task', `Remove "${task.title}" from the board?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeTask(task.id) },
    ]);
  };

  const confirmDeleteTeam = () => {
    Alert.alert('Delete team', `Delete "${team?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await removeTeam();
          if (ok) navigation.goBack();
        },
      },
    ]);
  };

  const members = team?.members || [];

  return (
    <SafeAreaView style={[styles.container, {backgroundColor:theme.background}]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.icon} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, {color:theme.text}]} numberOfLines={1}>
            {team?.name || teamName}
          </Text>
          <Text style={[styles.headerMeta, {color:theme.subtext}]}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={confirmDeleteTeam} style={styles.headerIcon}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* ACTION BAR */}
      <View style={[styles.actionBar, {borderBottomColor:theme.border}]}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setTaskModal(true)}>
          <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
          <Text style={[styles.actionText, {color:theme.text}]}>Add Task</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setMemberModal(true)}>
          <Ionicons name="person-add-outline" size={18} color={theme.accent}/>
          <Text style={[styles.actionText, {color:theme.text}]}>Add Member</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boardScroll}
        >
          {COLUMNS.map((col) => {
            const colTasks = columns[col.key] || [];
            return (
              <View key={col.key} style={[styles.column, {backgroundColor:theme.card, borderColor:theme.border},{ width: COLUMN_WIDTH }]}>
                <View style={styles.columnHeader}>
                  <View style={[styles.statusDot, { backgroundColor: col.color }]} />
                  <Text style={[styles.columnTitle, {color:theme.text}]}>{col.label}</Text>
                  <Text style={[styles.columnCount, {color:theme.subtext}]}>{colTasks.length}</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {colTasks.length === 0 ? (
                    <Text style={[styles.emptyColumn, {color:theme.subtext}]}>No tasks</Text>
                  ) : (
                    colTasks.map((task) => {
                      const dl = formatDeadline(task.deadline);
                      const editable = canModify(task);
                      return (
                        <View key={task.id} style={[styles.taskCard, {backgroundColor:theme.card, borderColor:theme.border}]}>
                          <Text style={[styles.taskTitle, {color:theme.text}]}>{task.title}</Text>
                          {!!task.description && (
                            <Text style={[styles.taskDesc, {color:theme.subtext}]} numberOfLines={2}>
                              {task.description}
                            </Text>
                          )}

                          {/* Meta row */}
                          <View style={styles.taskMetaRow}>
                            <View
                              style={[
                                styles.assigneePill, {backgroundColor: task.assigneeName ? `${theme.accent}20` : theme.border,},
                              ]}
                            >
                              <Ionicons
                                name="person"
                                size={11}
                                color={task.assigneeName ? theme.accent : theme.subtext}
                              />
                              <Text
                                style={[
                                  styles.assigneeText, {color: task.assigneeName ? theme.accent : theme.subtext,},
                                ]}
                              >
                                {task.assigneeName || 'Unassigned'}
                              </Text>
                            </View>
                            {dl && (
                              <View style={styles.deadlinePill}>
                                <Ionicons name="calendar-outline" size={11} color="#fbbf24" />
                                <Text style={styles.deadlineText}>{dl}</Text>
                              </View>
                            )}
                          </View>

                          {/* Progress */}
                          <View style={[styles.progressTrack, {backgroundColor:theme.border}]}>
                            <View
                              style={[
                                styles.progressFill,
                                { width: `${task.progress}%`, backgroundColor: col.color },
                              ]}
                            />
                          </View>
                          <Text style={[styles.progressLabel, {color:theme.subtext}]}>{task.progress}%</Text>

                          {/* Controls */}
                          {editable ? (
                            <View style={styles.controls}>
                              <TouchableOpacity
                                style={[styles.ctrlBtn, {backgroundColor: theme.border}]}
                                onPress={() => handleProgress(task, -25)}
                              >
                                <Text style={[styles.ctrlText, {color:theme.text}]}>−25</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.ctrlBtn, {backgroundColor: theme.border}]}
                                onPress={() => handleProgress(task, 25)}
                              >
                                <Text style={[styles.ctrlText, {color:theme.text}]}>+25</Text>
                              </TouchableOpacity>
                              {task.progress < 100 && (
                                <TouchableOpacity
                                  style={[styles.ctrlBtn, styles.doneBtn]}
                                  onPress={() => handleMarkDone(task)}
                                >
                                  <Ionicons name="checkmark" size={14} color="#34d399" />
                                </TouchableOpacity>
                              )}
                            </View>
                          ) : (
                            <Text style={[styles.lockedNote, {color:theme.subtext}]}>Assigned to {task.assigneeName}</Text>
                          )}

                          {/* Footer actions */}
                          <View style={[styles.cardFooter, {borderTopColor: theme.border}]}>
                            <TouchableOpacity
                              style={styles.footerBtn}
                              onPress={() => setAssignModal(task)}
                            >
                              <Ionicons name="swap-horizontal" size={13} color={theme.subtext} />
                              <Text style={[styles.footerBtnText, {color:theme.subtext}]}>Assign</Text>
                            </TouchableOpacity>
                            {(isOwner || task.assignedById === actor?.uid) && (
                              <TouchableOpacity
                                style={styles.footerBtn}
                                onPress={() => confirmDeleteTask(task)}
                              >
                                <Ionicons name="trash-outline" size={13} color="rgba(239,68,68,0.7)" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ADD TASK MODAL */}
      <Modal visible={taskModal} transparent animationType="slide" onRequestClose={() => setTaskModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {backgroundColor:theme.card, borderColor:theme.border}]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, {color:theme.text}]}>New Task</Text>

              <Text style={[styles.modalLabel, {color:theme.text}]}>Title</Text>
              <TextInput
                style={[styles.modalInput, {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor:theme.border,
                }]}
                placeholder="What needs to be done?"
                placeholderTextColor={theme.subtext}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.modalLabel, {color:theme.text}]}>Description (optional)</Text>
              <TextInput
                style={[styles.modalInput, { 
                  height: 70, 
                  textAlignVertical: 'top',
                  backgroundColor:theme.card,
                  color:theme.text,
                  borderColor:theme.border
                }]}
                placeholder="Add details..."
                placeholderTextColor={theme.subtext}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text style={[styles.modalLabel, {color:theme.text}]}>Deadline</Text>
              <View style={styles.chipRow}>
                {DEADLINE_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.chip, {backgroundColor:theme.card, borderColor:theme.border}, 
                    deadlineDays === p.days && styles.chipActive]}
                    onPress={() => setDeadlineDays(p.days)}
                  >
                    <Text style={[styles.chipText, {color: deadlineDays === p.days ? theme.text : theme.subtext,}, deadlineDays === p.days && {color:theme.text,},]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, {color:theme.text}]}>Assign to</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, {backgroundColor:theme.card, borderColor:theme.border}, 
                  !assignee && styles.chipActive]}
                  onPress={() => setAssignee(null)}
                >
                  <Text style={[styles.chipText, {color: !assignee ? theme.text : theme.subtext}, !assignee && {color:theme.text,}]}>Unassigned</Text>
                </TouchableOpacity>
                {members.map((m) => (
                  <TouchableOpacity
                    key={m.uid}
                    style={[styles.chip, {backgroundColor:theme.card, borderColor:theme.border}, 
                    assignee?.uid === m.uid && styles.chipActive]}
                    onPress={() => setAssignee({ uid: m.uid, name: m.name })}
                  >
                    <Text style={[styles.chipText, {color: assignee?.uid === m.uid ? theme.text : theme.subtext}, assignee?.uid === m.uid && {color:theme.text,}]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalCancel, {backgroundColor:theme.border}]}
                  onPress={() => {
                    setTaskModal(false);
                    resetTaskForm();
                  }}
                >
                  <Text style={[styles.modalCancelText, {color:theme.text}]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalConfirm]}
                  onPress={handleAddTask}
                  disabled={saving}
                >
                  <Text style={styles.modalConfirmText}>{saving ? 'Adding...' : 'Add Task'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ADD MEMBER MODAL */}
      <Modal visible={memberModal} transparent animationType="fade" onRequestClose={() => setMemberModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {backgroundColor:theme.card, borderColor:theme.border, borderWidth:1,}]}>
            <Text style={[styles.modalTitle, {color:theme.text}]}>Add Member</Text>
            <Text style={[styles.modalHint, {color:theme.subtext}]}>
              Enter the email your teammate uses for BALANSE. They’ll be notified and gain access to this board.
            </Text>
            <Text style={[styles.modalLabel, {color:theme.text}]}>Email</Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor:theme.card,
                color:theme.text,
                borderColor:theme.border,
              }]}
              placeholder="teammate@gmail.com"
              placeholderTextColor={theme.subtext}
              value={memberEmail}
              onChangeText={setMemberEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel, {backgroundColor:theme.border}]}
                onPress={() => {
                  setMemberModal(false);
                  setMemberEmail('');
                }}
              >
                <Text style={[styles.modalCancelText, {color:theme.text}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={handleAddMember}
                disabled={saving}
              >
                <Text style={styles.modalConfirmText}>{saving ? 'Adding...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ASSIGN MODAL */}
      <Modal visible={!!assignModal} transparent animationType="fade" onRequestClose={() => setAssignModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Task</Text>
            <Text style={styles.modalHint} numberOfLines={2}>
              {assignModal?.title}
            </Text>
            {members.map((m) => (
              <TouchableOpacity
                key={m.uid}
                style={styles.memberRow}
                onPress={() => handleAssign(m)}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.memberName}>{m.name}</Text>
                {assignModal?.assigneeId === m.uid && (
                  <Ionicons name="checkmark-circle" size={18} color="#34d399" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancel, { marginTop: 14 }]}
              onPress={() => setAssignModal(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { padding: 4, marginRight: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  headerMeta: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  headerIcon: { padding: 8 },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(167,139,250,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  actionText: { color: '#a78bfa', fontWeight: '600', fontSize: 13 },
  boardScroll: { paddingHorizontal: 12, paddingBottom: 20 },
  column: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
  },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  columnTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff', flex: 1 },
  columnCount: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emptyColumn: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  taskCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  taskDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 16 },
  taskMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10, marginTop: 4 },
  assigneePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(167,139,250,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  assigneePillEmpty: { backgroundColor: 'rgba(255,255,255,0.06)' },
  assigneeText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
  assigneeTextEmpty: { color: 'rgba(255,255,255,0.4)' },
  deadlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deadlineText: { fontSize: 11, color: '#fbbf24', fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    fontWeight: '600',
  },
  controls: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ctrlBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  ctrlText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  doneBtn: { backgroundColor: 'rgba(52,211,153,0.15)', flex: 0.6 },
  lockedNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
    marginTop: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  footerBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 22,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  modalHint: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 18 },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: 'rgba(124,58,237,0.3)', borderColor: '#7c3aed' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalCancel: { backgroundColor: 'rgba(255,255,255,0.08)' },
  modalCancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  modalConfirm: { backgroundColor: '#7c3aed' },
  modalConfirmText: { color: '#ffffff', fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { color: '#a78bfa', fontWeight: '700' },
  memberName: { flex: 1, color: '#ffffff', fontSize: 15, fontWeight: '500' },
});