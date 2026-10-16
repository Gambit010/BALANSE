import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Inverted against the screen (light toast in dark mode, dark in light mode)
// and sized to sit on the same line as the floating + button.
export default function UndoToast({ message = 'Task deleted', onUndo, isDarkMode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [anim]);

  const surface = isDarkMode ? '#ECEAF5' : '#1F1F33';
  const textColor = isDarkMode ? '#1F1F33' : '#FFFFFF';
  const actionColor = isDarkMode ? '#6D28D9' : '#C4B5FD';

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: surface,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <Ionicons name="trash-outline" size={16} color={textColor} />
      <Text style={[styles.message, { color: textColor }]} numberOfLines={1}>
        {message}
      </Text>
      <TouchableOpacity onPress={onUndo} style={styles.action} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.actionText, { color: actionColor }]}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 88, // leaves room for the 56px + button at right: 20
    bottom: 24,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});