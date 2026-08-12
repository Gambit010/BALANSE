import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPriorityBreakdown } from '../constants/scoring';
import { useTheme } from '../context/ThemeContext'; // for dark mode 

export default function PriorityBreakdownModal({ visible, task, onClose }) {
  if (!task) return null;
  const breakdown = getPriorityBreakdown(task);

  // Color the ring by the total score band
  const getScoreColor = (score) => {
    if (score >= 70) return '#ef4444'; // High
    if (score >= 40) return '#fb923c'; // Medium
    return '#34d399';                   // Low
  };

  const ringColor = getScoreColor(breakdown.total);
  const { theme, isDarkMode } = useTheme(); // for dark mode

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Tap outside the sheet to close */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Inner sheet — swallow taps so they don't close the modal */}
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
          onPress={() => {}}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="analytics-outline" size={18} color={theme.accent} />
              <Text style={[styles.headerTitle, {color: theme.accent}]}>Priority Breakdown</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1,}]}>
              <Ionicons name="close" size={20} color={theme.icon} />
            </TouchableOpacity>
          </View>

          {/* TASK TITLE */}
          <Text style={styles.taskTitle} numberOfLines={2}>
            {task.title}
          </Text>

          {/* SCORE CIRCLE */}
          <View style={styles.scoreSection}>
            <View style={[styles.scoreCircle, { borderColor: ringColor, backgroundColor: isDarkMode ? theme.card : 'rgba(204, 204, 204, 0.29)' }]}>
              <Text style={[styles.scoreNumber, { color: ringColor }]}>
                {breakdown.total}
              </Text>
              <Text style={[styles.scoreMax, { color: theme.subtext }]}>/ 100</Text>
            </View>
            <Text style={[styles.scoreLabel, { color: ringColor }]}>
              {task.priorityLabel} Priority
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border}]} />

          {/* FACTOR BREAKDOWN */}
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>How this score was computed</Text>
          <ScrollView style={styles.factorsScroll} showsVerticalScrollIndicator={false}>
            {breakdown.factors.map((factor) => {
              const pct = Math.min(100, (factor.score / factor.maxScore) * 100);
              return (
                <View key={factor.label} style={styles.factorRow}>
                  <View style={styles.factorHeader}>
                    <Text style={[styles.factorLabel, { color: theme.text }]}>{factor.label}</Text>
                    <Text style={styles.factorScore}>
                      {factor.score}
                      <Text style={[styles.factorMax, { color: theme.subtext }]}> / {factor.maxScore}</Text>
                    </Text>
                  </View>
                  <Text style={[styles.factorReason, { color: theme.subtext }]}>{factor.reason}</Text>
                  <View style={[styles.barBg, { backgroundColor: theme.border}]}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* FOOTER */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={14} color={theme.subtext} />
            <Text style={[styles.footerText, { color: theme.subtext }]}>
              Higher scores are surfaced first in Today's Focus.
            </Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a78bfa',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    lineHeight: 22,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: -4,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  factorsScroll: {
    maxHeight: 260,
  },
  factorRow: {
    marginBottom: 14,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  factorLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  factorScore: {
    fontSize: 15,
    fontWeight: '800',
    color: '#a78bfa',
  },
  factorMax: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  factorReason: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
  },
  barFill: {
    height: 6,
    backgroundColor: '#a78bfa',
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
  },
});
