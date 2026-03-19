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

         {/* OVERALL PROGRESS CARD */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Overall Progress</Text>
            <Text style={styles.progressFraction}>
              {completedTasks}/{totalTasks} tasks done
            </Text>
          </View>

          <Text style={styles.progressPercent}>{overallProgress}%</Text>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${overallProgress}%` }]} />
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{highPriorityTasks}</Text>
              <Text style={styles.statLabel}>High Priority</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{inProgressTasks}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{dueTodayTasks}</Text>
              <Text style={styles.statLabel}>Due Today</Text>
            </View>
          </View>
        </View>


          {/* TASKS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Tasks</Text>
        </View>

        {/* Academic */}
        <TouchableOpacity style={styles.categoryCard}>
          <View style={[styles.categoryIcon, { backgroundColor: '#3b5bdb' }]}>
            <Ionicons name="book-outline" size={20} color="#ffffff" />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>Academic</Text>
            <Text style={styles.categoryCount}>
              {tasks.filter(t => t.category === 'Academic').length} active tasks
            </Text>
          </View>
          <Text style={styles.categoryNumber}>
            {tasks.filter(t => t.category === 'Academic').length}
          </Text>
        </TouchableOpacity>

        {/* Organization */}
        <TouchableOpacity style={styles.categoryCard}>
          <View style={[styles.categoryIcon, { backgroundColor: '#9c36b5' }]}>
            <Ionicons name="people-outline" size={20} color="#ffffff" />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>Organization</Text>
            <Text style={styles.categoryCount}>
              {tasks.filter(t => t.category === 'Organization').length} active tasks
            </Text>
          </View>
          <Text style={styles.categoryNumber}>
            {tasks.filter(t => t.category === 'Organization').length}
          </Text>
        </TouchableOpacity>

        {/* Personal */}
        <TouchableOpacity style={styles.categoryCard}>
          <View style={[styles.categoryIcon, { backgroundColor: '#0ca678' }]}>
            <Ionicons name="heart-outline" size={20} color="#ffffff" />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>Personal</Text>
            <Text style={styles.categoryCount}>
              {tasks.filter(t => t.category === 'Personal').length} active tasks
            </Text>
          </View>
          <Text style={styles.categoryNumber}>
            {tasks.filter(t => t.category === 'Personal').length}
          </Text>
        </TouchableOpacity>

        {/* PRIORITY TASKS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Priority Tasks</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
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

  // homescreen header attributes
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
  }, //end of homescreen header

//progress/stats card attributes
  progressCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  progressFraction: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  progressPercent: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 20,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#a78bfa',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  }, // end of progress/stats card attributes
  
// your task section attribute
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 3,
  },
  categoryCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  categoryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#a78bfa',
  }, // end of your task section attributes

  // priority tasks section attributes
  viewAll: {
    fontSize: 13,
    color: '#a78bfa',
    fontWeight: '600',
  },
});