import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useTasks } from '../hooks/useTasks';

export default function ProfileScreen({ navigation }) {
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { tasks } = useTasks();

  const [userName, setUserName] = useState('Student');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserName(user.displayName || 'Student');
        setUserEmail(user.email || '');
      }
    });
    return unsubscribe;
  }, []);

  // Computed stats from real task data
  const completedTasks = tasks.filter(t => t.progress === 100).length;
  const inProgressTasks = tasks.filter(t => t.progress > 0 && t.progress < 100).length;
  const successRate = tasks.length > 0
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

    /*
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };
  */

  /*const handleLogout = async () => {
    try {
      // Sign out from Google native session too
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch (error) {
      // Ignore Google sign out errors — user may not have signed in with Google
      console.log('Google signout:', error);
    } finally {
      // Always sign out from Firebase
      await signOut(auth);
    }
  };*/
    const handleLogout = async () => {
    try {
      // Expo Go: just sign out from Firebase (no native Google session to clear)
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}
        <Text style={styles.screenTitle}>Profile</Text>

        {/* AVATAR + USER INFO */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>Student Leader</Text>
          </View>
        </View>

        {/* STATS ROW */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{completedTasks}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{inProgressTasks}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{successRate}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>

        {/* SETTINGS */}
        <View style={styles.settingsCard}>

          {/* Dark Mode */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(167,139,250,0.2)' }]}>
                <Ionicons name="moon-outline" size={18} color="#a78bfa" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Dark Mode</Text>
                <Text style={styles.settingSubtitle}>Easier on the eyes</Text>
              </View>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#7c3aed' }}
              thumbColor={darkMode ? '#ffffff' : 'rgba(255,255,255,0.5)'}
            />
          </View>

          <View style={styles.separator} />

          {/* Notifications */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(251,146,60,0.2)' }]}>
                <Ionicons name="notifications-outline" size={18} color="#fb923c" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Notifications</Text>
                <Text style={styles.settingSubtitle}>Task reminders and alerts</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#7c3aed' }}
              thumbColor={notificationsEnabled ? '#ffffff' : 'rgba(255,255,255,0.5)'}
            />
          </View>

          <View style={styles.separator} />

          {/* Settings */}
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(52,211,153,0.2)' }]}>
                <Ionicons name="settings-outline" size={18} color="#34d399" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Settings</Text>
                <Text style={styles.settingSubtitle}>App preferences</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Help */}
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(96,165,250,0.2)' }]}>
                <Ionicons name="help-circle-outline" size={18} color="#60a5fa" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Help & Support</Text>
                <Text style={styles.settingSubtitle}>Get assistance</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Analytics */}
          <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Analytics')}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(167,139,250,0.2)' }]}>
                <Ionicons name="analytics-outline" size={18} color="#a78bfa" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Analytics & Insights</Text>
                <Text style={styles.settingSubtitle}>View your trends and patterns</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

        </View>

        {/* LOGOUT */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    paddingTop: 20,
    marginBottom: 24,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  roleTag: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  roleText: {
    fontSize: 12,
    color: '#a78bfa',
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  settingsCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});



  