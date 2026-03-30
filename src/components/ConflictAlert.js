import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SEVERITY_CONFIG = {
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'alert-circle', label: 'Conflict' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: 'warning', label: 'Warning' },
  low: { color: '#fb923c', bg: 'rgba(251,146,60,0.08)', icon: 'information-circle', label: 'Note' },
};

export default function ConflictAlert({ conflicts, style }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!conflicts || conflicts.length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Ionicons name="git-compare-outline" size={16} color="#ef4444" />
        <Text style={styles.headerText}>
          {conflicts.length} scheduling {conflicts.length === 1 ? 'conflict' : 'conflicts'} detected
        </Text>
      </View>

      {conflicts.map((conflict, index) => {
        const config = SEVERITY_CONFIG[conflict.severity] || SEVERITY_CONFIG.low;
        const isExpanded = expandedIndex === index;

        return (
          <TouchableOpacity
            key={index}
            style={[styles.conflictCard, { backgroundColor: config.bg, borderLeftColor: config.color }]}
            onPress={() => setExpandedIndex(isExpanded ? null : index)}
            activeOpacity={0.7}
          >
            <View style={styles.conflictTopRow}>
              <Ionicons name={config.icon} size={16} color={config.color} />
              <Text style={[styles.severityLabel, { color: config.color }]}>{config.label}</Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="rgba(255,255,255,0.4)"
              />
            </View>

            <Text style={styles.conflictMessage}>{conflict.message}</Text>

            {isExpanded && conflict.suggestion && (
              <View style={styles.suggestionBox}>
                <Ionicons name="bulb-outline" size={14} color="#a78bfa" />
                <Text style={styles.suggestionText}>{conflict.suggestion}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  conflictCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  conflictTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  severityLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    flex: 1,
  },
  conflictMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    backgroundColor: 'rgba(167,139,250,0.1)',
    padding: 10,
    borderRadius: 8,
  },
  suggestionText: {
    fontSize: 12,
    color: '#a78bfa',
    lineHeight: 17,
    flex: 1,
  },
});
