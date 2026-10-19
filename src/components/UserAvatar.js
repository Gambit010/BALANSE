import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

// Google photo URLs end in "=s96-c" (96px); asking for 256px keeps the big
// Profile avatar sharp. Other URLs are left as they are.
const sharpen = (url) => url.replace(/=s\d+-c$/, '=s256-c');

// Shows the Google sign-in photo when there is one, otherwise the first
// letter of the name on the purple circle used before.
export default function UserAvatar({ name, photoURL, size = 40 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoURL]);

  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (photoURL && !failed) {
    return (
      <Image
        source={{ uri: sharpen(photoURL) }}
        style={[styles.base, circle]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.base, styles.center, circle]}>
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>
        {(name || 'Student').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#7c3aed' },
  center: { justifyContent: 'center', alignItems: 'center' },
  initial: { color: '#ffffff', fontWeight: '700' },
});