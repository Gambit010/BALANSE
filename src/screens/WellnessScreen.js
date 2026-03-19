import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function WellnessScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Wellness Screen</Text>
      <Text style={styles.sub}>WHO-5 Well-being Monitor</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
});