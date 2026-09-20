import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
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
export default function TaskActionModal({ visible, task, theme, onClose, onSetStatus, onViewBreakdown, onEdit, onDelete }) {
  if (!task) return null;
  const currentStatus = statusFromProgress(task.progress);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{task.title}</Text>

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

          <TouchableOpacity style={styles.option} onPress={onViewBreakdown}>
            <Ionicons name="information-circle-outline" size={20} color="#a78bfa" />
            <Text style={[styles.optionText, { color: '#a78bfa' }]}>View Priority Breakdown</Text>
          </TouchableOpacity>

          {!task.isTeamTask && (
            <TouchableOpacity style={styles.option} onPress={onEdit}>
              <Ionicons name="create-outline" size={20} color={theme.text} />
              <Text style={[styles.optionText, { color: theme.text }]}>Edit Details</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.option} onPress={onDelete}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={[styles.optionText, { color: '#ef4444' }]}>Delete Task</Text>
          </TouchableOpacity>

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
    marginBottom: 14,
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