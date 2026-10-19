import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getActivity, toLocalDateKey } from '../services/activityService';
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
import { useTheme } from '../context/ThemeContext'; // for global dark mode 
import { getNotificationsEnabled, setNotificationsEnabled } from '../services/pushNotificationServices';

// Task-completion milestones, counted over every task ever finished (see
// lifetimeCompleted below), so a badge stays earned after a task is deleted.
const MILESTONES = [
  { threshold: 1, label: 'First Task', icon: 'flag-outline' },
  { threshold: 10, label: '10 Tasks', icon: 'ribbon-outline' },
  { threshold: 25, label: '25 Tasks', icon: 'medal-outline' },
  { threshold: 50, label: '50 Tasks', icon: 'trophy-outline' },
];

export default function ProfileScreen({ navigation }) {
  //const [darkMode, setDarkMode] = useState(false);
  const { isDarkMode, toggleDarkMode, theme } = useTheme(); // this replace the code above 
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const { tasks, refetch } = useTasks();
  const [activeDays, setActiveDays] = useState([]);
  const [completedTaskIds, setCompletedTaskIds] = useState([]);

  useEffect(() => {
    getNotificationsEnabled().then(setNotificationsEnabledState);
  }, []);

  // Refresh on focus so a task finished elsewhere shows up when you come back.
  useFocusEffect(
    useCallback(() => {
      refetch();
      const uid = auth.currentUser?.uid;
      if (uid) {
        getActivity(uid).then((activity) => {
          setActiveDays(activity.activeDays);
          setCompletedTaskIds(activity.completedTaskIds);
        });
      }
    }, [])
  );

  // Oldest → today, left to right.
  const lastSevenDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const activeSet = new Set(activeDays);
  const activeCount = lastSevenDays.filter((d) => activeSet.has(toLocalDateKey(d))).length;

  const toggleNotifications = async (value) => {
    setNotificationsEnabledState(value);
    await setNotificationsEnabled(value);
  };

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

  // Computed stats from real task data. Class sessions are left out: they're
  // never marked Done, so a semester of them would pull the rate toward 0%.
  const statTasks = tasks.filter(t => !t.recurrence?.isClassSchedule);
  const completedTasks = statTasks.filter(t => t.progress === 100).length;
  const inProgressTasks = statTasks.filter(t => t.progress > 0 && t.progress < 100).length;
  const successRate = statTasks.length > 0
    ? Math.round((completedTasks / statTasks.length) * 100)
    : 0;

  // Every task ever finished: the saved IDs, plus tasks that are Done right
  // now (covers tasks completed before IDs were being saved).
  const lifetimeCompleted = new Set([
    ...completedTaskIds,
    ...statTasks.filter(t => t.progress === 100).map(t => t.id),
  ]).size;
  const nextMilestone = MILESTONES.find(m => lifetimeCompleted < m.threshold);

    /*
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };
  */

    const handleLogout = async () => {
    try {
      // Expo Go: just sign out from Firebase (no native Google session to clear)
      // Now, it signs out from Google's native session first, then Firebase. 
      // The try/catch ensures Firebase logout always happens even if Google signout fails 
      // (e.g. user logged in with email not Google)
      const { handleGoogleSignOut } = await import('../services/authService');
      await handleGoogleSignOut();
      //await signOut(auth);
    } catch (error) {
      console.error('Google signout:', error);
    } finally {
      await signOut(auth);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background}]}> 
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}
        <Text style={[styles.screenTitle, { color: theme.text }]}>Profile</Text>

        {/* AVATAR + USER INFO */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
          <Text style={[styles.userEmail, { color: theme.subtext }]}>{userEmail}</Text>
          {/*}
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>Student Leader</Text>
          </View>
          */}
        </View>

        {/* STATS ROW */}
        <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{completedTasks}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Completed</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border},]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{inProgressTasks}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>In Progress</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border},]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{successRate}%</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>Success Rate</Text>
          </View>
        </View>

        {/* THIS WEEK — no streak to lose; a missed day is just an empty circle */}
        <View style={[styles.achievementsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.achievementsTitle, { color: theme.text }]}>This Week</Text>
          <View style={styles.weekRow}>
            {lastSevenDays.map((d, i) => {
              const active = activeSet.has(toLocalDateKey(d));
              const isToday = i === 6;
              return (
                <View key={toLocalDateKey(d)} style={styles.weekDay}>
                  <View style={[
                    styles.weekDot,
                    {
                      backgroundColor: active ? 'rgba(167,139,250,0.2)' : 'transparent',
                      borderColor: active ? '#a78bfa' : theme.border,
                    },
                  ]}>
                    {active && <Ionicons name="checkmark" size={14} color="#a78bfa" />}
                  </View>
                  <Text style={[
                    styles.weekDayLabel,
                    { color: isToday ? theme.text : theme.subtext, fontWeight: isToday ? '700' : '500' },
                  ]}>
                    {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.weekSummary, { color: theme.subtext }]}>
            {activeCount > 0
              ? `Active ${activeCount} of the last 7 days`
              : 'Days you complete a task will show up here.'}
          </Text>
        </View>

        {/* ACHIEVEMENTS */}
        <View style={[styles.achievementsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.achievementsTitle, { color: theme.text }]}>Achievements</Text>
          <View style={styles.achievementsRow}>
            {MILESTONES.map((m) => {
              const earned = lifetimeCompleted >= m.threshold;
              return (
                <View key={m.threshold} style={styles.achievementItem}>
                  <View style={[
                    styles.achievementIcon,
                    {
                      backgroundColor: earned ? 'rgba(167,139,250,0.2)' : theme.background,
                      borderColor: earned ? '#a78bfa' : theme.border,
                    },
                  ]}>
                    <Ionicons name={m.icon} size={22} color={earned ? '#a78bfa' : theme.subtext} />
                  </View>
                  <Text style={[styles.achievementLabel, { color: earned ? theme.text : theme.subtext }]}>
                    {m.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.achievementProgress, { color: theme.subtext }]}>
            {nextMilestone
              ? `${lifetimeCompleted} of ${nextMilestone.threshold} tasks done for "${nextMilestone.label}"`
              : `All badges earned · ${lifetimeCompleted} tasks done`}
          </Text>
        </View>

        {/* SETTINGS */}
        <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 

          {/* Dark Mode */} 
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(167,139,250,0.2)' }]}>
                <Ionicons name="moon-outline" size={18} color="#a78bfa" />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Dark Mode</Text>
                <Text style={[styles.settingSubtitle, { color: theme.subtext }]}>Easier on the eyes</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: theme.border, true: '#7c3aed' }}
              thumbColor={isDarkMode ? '#ffffff' : '#64748b'}
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
                <Text style={[styles.settingTitle, { color: theme.text }]}>Notification</Text>
                <Text style={[styles.settingSubtitle, { color: theme.subtext }]}>Task reminders and alerts</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: theme.border, true: '#7c3aed' }}
              thumbColor={notificationsEnabled ? '#ffffff' : '#64748b'}
            />
          </View>

          <View style={styles.separator} />

          {/* Settings 
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(52,211,153,0.2)' }]}>
                <Ionicons name="settings-outline" size={18} color="#34d399" />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Settings</Text>
                <Text style={[styles.settingSubtitle, { color: theme.subtext }]}>App preferences</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          <View style={styles.separator} />

           Help 
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(96,165,250,0.2)' }]}>
                <Ionicons name="help-circle-outline" size={18} color="#60a5fa" />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Help & Support</Text>
                <Text style={[styles.settingSubtitle, { color: theme.subtext }]}>Get assistance</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
          */}

          <View style={styles.separator} />

          {/* Analytics */}
          <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Analytics')}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(167,139,250,0.2)' }]}>
                <Ionicons name="analytics-outline" size={18} color="#a78bfa" />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Analytics & Insights</Text>
                <Text style={[styles.settingSubtitle, { color: theme.subtext }]}>View your trends and patterns</Text>
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
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekDay: {
    alignItems: 'center',
    gap: 6,
  },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDayLabel: {
    fontSize: 11,
  },
  weekSummary: {
    fontSize: 13,
  },
  achievementsCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  achievementsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 14,
  },
  achievementsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  achievementItem: {
    alignItems: 'center',
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  achievementLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  achievementProgress: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
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



  