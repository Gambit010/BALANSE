import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STATUSES = [
  { key: 'todo', label: 'To Do', progress: 0, color: '#94a3b8' },
  { key: 'in-progress', label: 'In Progress', progress: 50, color: '#fb923c' },
  { key: 'done', label: 'Done', progress: 100, color: '#34d399' },
];

const statusFromProgress = (progress) => {
  if (progress >= 100) return 'done';
  if (progress > 0) return 'in-progress';
  return 'todo';
};

const formatTime = (d) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

// "Fri, Oct 17 · 3:00 PM – 4:00 PM", or "Fri, Oct 17 · All day" for date-only
// deadlines. Date-only strings are read as local dates so they never shift a day.
const formatWhen = (task) => {
  if (!task.deadline) return 'No deadline';
  const hasTime = task.deadline.includes('T');
  let date;
  if (hasTime) {
    date = new Date(task.deadline);
  } else {
    const [y, m, d] = task.deadline.split('-').map(Number);
    date = new Date(y, m - 1, d);
  }
  if (isNaN(date.getTime())) return 'No deadline';

  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!hasTime) return `${day} · All day`;

  const end = task.endTime ? new Date(task.endTime) : null;
  const range = end && !isNaN(end.getTime()) && end > date
    ? `${formatTime(date)} – ${formatTime(end)}`
    : formatTime(date);
  return `${day} · ${range}`;
};

const isOverdue = (task) => {
  if (!task.deadline || task.progress >= 100 || task.recurrence?.isClassSchedule) return false;
  if (task.deadline.includes('T')) return new Date(task.deadline) < new Date();
  const [y, m, d] = task.deadline.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999) < new Date();
};

/**
 * Shown when a task card is tapped. This is now the ONLY way to change
 * status, edit, or delete a task — the old bottom-row buttons (progress
 * checkmark, edit icon, delete icon) were removed to avoid duplicate
 * controls once this modal existed.
 *
 * Status is three explicit named choices (To Do / In Progress / Done),
 * matching the pattern already used on team task cards, rather than a
 * single ambiguous "mark complete" toggle cycling through raw numbers.
 * Picking a status auto-closes the modal immediately.
 */
export default function TaskActionModal({ visible, task, theme, onClose, onSetStatus, onViewBreakdown, onEdit, onSnooze, onPickDate, onDelete, onDeleteSeries }) {
  if (!task) return null;
  const currentStatus = statusFromProgress(task.progress);
  // Rescheduling moves only the start time, and a class has no meaningful
  // priority, so those options are hidden for class sessions.
  const isClass = !!task.recurrence?.isClassSchedule;
  // Classes and "Repeat weekly" tasks are both a series of sessions.
  const isRecurring = !!task.recurrence?.templateName;
  const overdue = isOverdue(task);
  const meta = [
    task.isTeamTask && 'Team task',
    task.category,
    isClass ? 'Class' : task.priorityLabel && `${task.priorityLabel} priority`,
  ].filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{task.title}</Text>

          {/* Details: when it's due, what kind of task it is, and its description */}
          <View style={styles.detailRow}>
            <Ionicons
              name={isClass ? 'school-outline' : 'calendar-outline'}
              size={15}
              color={overdue ? '#ef4444' : theme.subtext}
            />
            <Text style={[styles.detailText, { color: overdue ? '#ef4444' : theme.text }]}>
              {isClass ? 'Schedule: ' : 'Due: '}
              {formatWhen(task)}
              {overdue ? ' (Overdue)' : ''}
            </Text>
          </View>

          {meta.length > 0 && (
            <View style={styles.detailRow}>
              <Ionicons name={task.isTeamTask ? 'people-outline' : 'pricetag-outline'} size={15} color={theme.subtext} />
              <Text style={[styles.detailText, { color: theme.subtext }]}>{meta.join(' · ')}</Text>
            </View>
          )}

          {!!task.description?.trim() && (
            <ScrollView style={[styles.descriptionBox, { backgroundColor: theme.background, borderColor: theme.border }]} nestedScrollEnabled>
              <Text style={[styles.descriptionText, { color: theme.text }]}>{task.description.trim()}</Text>
            </ScrollView>
          )}

          <View style={{ height: 14 }} />

          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>Status</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => {
              const isActive = currentStatus === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.statusChip,
                    { borderColor: s.color, backgroundColor: isActive ? s.color : 'transparent' },
                  ]}
                  onPress={() => onSetStatus(s.progress)}
                >
                  <Text style={[styles.statusChipText, { color: isActive ? '#fff' : theme.subtext }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {!isClass && (
            <TouchableOpacity style={styles.option} onPress={onViewBreakdown}>
              <Ionicons name="information-circle-outline" size={20} color="#a78bfa" />
              <Text style={[styles.optionText, { color: '#a78bfa' }]}>View Priority Breakdown</Text>
            </TouchableOpacity>
          )}

          {!task.isTeamTask && (
            <TouchableOpacity style={styles.option} onPress={onEdit}>
              <Ionicons name="create-outline" size={20} color={theme.text} />
              <Text style={[styles.optionText, { color: theme.text }]}>Edit Details</Text>
            </TouchableOpacity>
          )}

          {!task.isTeamTask && !isClass && onSnooze && (
            <TouchableOpacity style={styles.option} onPress={onSnooze}>
              <Ionicons name="time-outline" size={20} color={theme.text} />
              <Text style={[styles.optionText, { color: theme.text }]}>Push Deadline +1 Day</Text>
            </TouchableOpacity>
          )}

          {!task.isTeamTask && !isClass && onPickDate && (
            <TouchableOpacity style={styles.option} onPress={onPickDate}>
              <Ionicons name="calendar-outline" size={20} color={theme.text} />
              <Text style={[styles.optionText, { color: theme.text }]}>Pick a New Date</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.option} onPress={onDelete}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={[styles.optionText, { color: '#ef4444' }]}>
              {isRecurring ? 'Delete This Session' : 'Delete Task'}
            </Text>
          </TouchableOpacity>

          {isRecurring && onDeleteSeries && (
            <TouchableOpacity style={styles.option} onPress={onDeleteSeries}>
              <Ionicons name="trash-bin-outline" size={20} color="#ef4444" />
              <Text style={[styles.optionText, { color: '#ef4444' }]}>Delete All Upcoming Sessions</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.border }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  descriptionBox: {
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginBottom: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    fontWeight: '600',
  },
});