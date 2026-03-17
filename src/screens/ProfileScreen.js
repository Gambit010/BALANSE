import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export default function ProfileScreen() {
    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View style={styles.container}>
        <Text style={styles.text}>Profile Screen</Text>
        <Text style={styles.sub}>Coming soon</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f23' },
    text: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
    sub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
    logoutButton: { marginTop: 30, backgroundColor: '#ef4444', padding: 14, borderRadius: 10, width: 200, alignItems: 'center' },
    logoutText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});

