import React, { useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { useTasks } from '../hooks/useTasks';
import { getPriorityBreakdown } from '../constants/scoring';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen({ navigation }) {
  const { tasks, loading, error, refetch } = useTasks();
  const [userName, setUserName] = useState('Student');

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('User display name:', user.displayName);
        console.log('User email:', user.email);
        setUserName(user.displayName || 'Student');
      }
    });
    return unsubscribe;
  }, []);

  // Computed stats from tasks array
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.progress === 100).length;
  const highPriorityTasks = tasks.filter(task => task.priorityLabel === 'High').length;
  const inProgressTasks = tasks.filter(task => task.progress > 0 && task.progress < 100).length;
  
  const today = new Date().toDateString();
  const dueTodayTasks = tasks.filter(task => 
    new Date(task.deadline).toDateString() === today
  ).length;

  const overallProgress = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

      // Today's Focus — top 5 incomplete tasks, auto-selected by the priority engine
  const todaysFocus = tasks
    .filter(task => task.progress < 100)
    .slice(0, 5);

  const getDaysUntilDeadline = (deadline) => {
    const now = new Date();
    const dl = new Date(deadline);
    now.setHours(0, 0, 0, 0);
    dl.setHours(0, 0, 0, 0);
    return Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
  };

  const getDeadlineUrgency = (deadline) => {
    const days = getDaysUntilDeadline(deadline);
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: '#f87171' };
    if (days === 0) return { text: 'Due today', color: '#f87171' };
    if (days === 1) return { text: 'Due tomorrow', color: '#fbbf24' };
    if (days <= 3) return { text: `${days} days left`, color: '#fbbf24' };
    return { text: `${days} days left`, color: 'rgba(255,255,255,0.4)' };
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Academic': return '#3b5bdb';
      case 'Organization': return '#9c36b5';
      case 'Personal': return '#0ca678';
      default: return '#a78bfa';
    }
  };

  const getPriorityColor = (label) => {
    switch (label) {
      case 'High': return '#ef4444';
      case 'Medium': return '#fb923c';
      case 'Low': return '#34d399';
      default: return '#a78bfa';
    }
  };

  

    if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>Loading your tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: 12, justifyContent: 'center' }}>
            <Text style={styles.greeting} numberOfLines={1}>Hey, {userName} 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>

          </View>
        </View>

                {/* TODAY'S FOCUS */}
        {todaysFocus.length > 0 && (
          <View style={styles.focusSection}>
            <View style={styles.focusSectionHeader}>
              <View style={styles.focusTitleRow}>
                <Ionicons name="flash" size={20} color="#fbbf24" />
                <Text style={styles.focusSectionTitle}>Today's Focus</Text>
              </View>
              <Text style={styles.focusSubtitle}>
                {todaysFocus.length} task{todaysFocus.length !== 1 ? 's' : ''} to focus on
              </Text>
            </View>

            {todaysFocus.map((task, index) => {
              const urgency = getDeadlineUrgency(task.deadline);
              const catColor = getCategoryColor(task.category);
              const prioColor = getPriorityColor(task.priorityLabel);
              const breakdown = getPriorityBreakdown(task);

              return (
                <TouchableOpacity
                  key={task.id}
                  style={styles.focusCard}
                  onPress={() => navigation.getParent()?.navigate('EditTask', { task })}
                  activeOpacity={0.7}
                >
                  <View style={styles.focusRank}>
                    <Text style={styles.focusRankText}>{index + 1}</Text>
                  </View>

                  <View style={styles.focusContent}>
                    <View style={styles.focusTitleContainer}>
                      <Text style={styles.focusTaskTitle} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <View style={[styles.focusPrioBadge, { backgroundColor: `${prioColor}20` }]}>
                        <Text style={[styles.focusPrioText, { color: prioColor }]}>
                          {task.priorityLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.focusTagsRow}>
                      <View style={[styles.focusCategoryTag, { backgroundColor: `${catColor}20` }]}>
                        <View style={[styles.focusCategoryDot, { backgroundColor: catColor }]} />
                        <Text style={[styles.focusCategoryText, { color: catColor }]}>
                          {task.category}
                        </Text>
                      </View>
                      <View style={styles.focusDeadlineTag}>
                        <Ionicons name="time-outline" size={11} color={urgency.color} />
                        <Text style={[styles.focusDeadlineText, { color: urgency.color }]}>
                          {urgency.text}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.focusReason}>
                      {breakdown.factors
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 2)
                        .map(f => `${f.label}: ${f.reason} (${f.score}pts)`)
                        .join('  ·  ')}
                    </Text>

                    <View style={styles.focusProgressRow}>
                      <View style={styles.focusProgressBg}>
                        <View style={[styles.focusProgressFill, { width: `${task.progress}%` }]} />
                      </View>
                      <Text style={styles.focusProgressText}>{task.progress}%</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}


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
          <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
       

         {/* TASK CARDS */}
        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={56} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to add your first task
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddTask')}
            >
              <Text style={styles.emptyButtonText}>Add your first task</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tasks.slice(0, 3).map((task) => (
            <View key={task.id} style={styles.taskCard}>
              
              {/* Task Title and Priority Badge */}
              <View style={styles.taskTopRow}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                <View style={[
                  styles.priorityBadge,
                  task.priority === 'High' && styles.priorityHigh,
                  task.priority === 'Medium' && styles.priorityMedium,
                  task.priority === 'Low' && styles.priorityLow,
                ]}>
                  <Text style={styles.priorityText}>{task.priorityLabel}</Text>
                </View>
              </View>

              {/* Category and Deadline */}
              <View style={styles.taskMidRow}>
                <Text style={styles.taskCategory}>{task.category}</Text>
                <View style={styles.taskDeadline}>
                  <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.taskDeadlineText}>{task.deadline}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.taskProgressBg}>
                <View style={[styles.taskProgressFill, { width: `${task.progress}%` }]} />
              </View>

              {/* Bottom Row */}
              <View style={styles.taskBottomRow}>
                <View style={styles.assigneeRow}>
                  {task.assignments && task.assignments.slice(0, 3).map((initial, index) => (
                    <View
                      key={index}
                      style={[styles.assigneeAvatar, { marginLeft: index === 0 ? 0 : -8 }]}
                    >
                      <Text style={styles.assigneeInitial}>{initial}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.taskProgressText}>
                      {task.progress === 0 ? 'To Do' : task.progress === 100 ? 'Done' : 'In Progress'}
                </Text>

              </View>

            </View>
          ))
        )}
          
            </ScrollView>
      <TouchableOpacity
        style={styles.addButton}
        
        onPress={() => navigation.getParent()?.navigate('AddTask')}


      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
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
    marginBottom: 2,
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
  taskCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityHigh: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  priorityMedium: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
  },
  priorityLow: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  taskMidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskCategory: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  taskDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDeadlineText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  taskProgressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 10,
  },
  taskProgressFill: {
    height: 4,
    backgroundColor: '#a78bfa',
    borderRadius: 2,
  },
  taskBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assigneeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a1a3e',
  },
  assigneeInitial: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  taskProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  //loading state attributes
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 14,
  },
  //add task button attributes
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  // empty state attributes
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
  },
  emptyButtonText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },

    // Today's Focus styles
  focusSection: {
    marginBottom: 24,
  },
  focusSectionHeader: {
    marginBottom: 14,
  },
  focusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  focusSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    marginLeft: 28,
  },
  focusCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a3e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    alignItems: 'flex-start',
  },
  focusRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  focusRankText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a78bfa',
  },
  focusContent: {
    flex: 1,
  },
  focusTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  focusTaskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  focusPrioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  focusPrioText: {
    fontSize: 10,
    fontWeight: '700',
  },
  focusTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  focusCategoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  focusCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  focusCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  focusDeadlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  focusDeadlineText: {
    fontSize: 11,
    fontWeight: '500',
  },
  focusReason: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 8,
    lineHeight: 16,
  },
  focusProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusProgressBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
  },
  focusProgressFill: {
    height: 4,
    backgroundColor: '#a78bfa',
    borderRadius: 2,
  },
  focusProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    width: 30,
    textAlign: 'right',
  },

});