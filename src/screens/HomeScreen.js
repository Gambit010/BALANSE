import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

// Dummy data - will replace this with real firestore data later
const dummyData = [
  { id : '1', title: 'Submit balanse docu', category: 'Academic', priority: 'High', deadline: 'March 27', progress: 30, assignments: ['A'] },
  { id : '2', title: 'GameProg TP', category: 'Academic', priority: 'Medium', deadline: 'March 30', progress: 0, assignments: ['G', 'M'] },
  { id : '3', title: 'CompOrg TP', category: 'Academic', priority: 'Medium', deadline: 'March 31', progress: 0, assignments: ['A', 'C'] },
  { id : '4', title: 'Thesis track progress/defense', category: 'Academic', priority: 'High', deadline: 'March 27', progress: 30, assignments: ['S', 'C', 'K', 'E'] },
];

export default function HomeScreen({ navigation }) {
  const [tasks, setTasks] = useState(dummyData);

  // Computed stats from tasks array
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.progress === 100).length;
  const highPriorityTasks = tasks.filter(task => task.priority === 'High').length;
  const inProgressTasks = tasks.filter(task => task.progress > 0 && task.progress < 100).length;
  const dueTodayTasks = tasks.filter(task => task.deadline === 'Feb 18').length;
  const overallProgress = totalTasks > 0 
    ? Math.round((completedTasks / totalTasks) * 100) 
    : 0;

  // Get current user from Firebase Auth
  const currentUser = auth.currentUser;
  const userName = currentUser?.displayName || 'Student';
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, {userName} 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={24} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

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
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  date: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});