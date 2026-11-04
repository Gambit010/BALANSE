import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // Make sure this is imported
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

import HomeScreen from '../screens/HomeScreen';
import TasksScreen from '../screens/TasksScreen';
import CalendarScreen from '../screens/CalendarScreen';
import WellnessScreen from '../screens/WellnessScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import TeamsScreen from '../screens/TeamsScreen';
import MyAssignmentsScreen from '../screens/MyAssignmentsScreen'; // Keep import

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator(); // Create a Stack for Teams flow
const ProfileStack = createNativeStackNavigator();

// 1. Create a Stack for the Teams Flow (Teams List + My Assignments)
function TeamsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeamsList" component={TeamsScreen} />
      <Stack.Screen 
        name="MyAssignments" 
        component={MyAssignmentsScreen} 
        options={{ title: 'My Assignments' }} // Optional: Set header title
      />
    </Stack.Navigator>
  );
}

// 2. Existing Profile Stack
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="Analytics" component={AnalyticsScreen} />
    </ProfileStack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme, isDarkMode } = useTheme();
  // Space taken by the phone's own navigation (the back/home buttons or the
  // gesture line). The app draws edge to edge, so the tab bar sits above it.
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.tabBar,
            borderTopColor: theme.border,
            borderTopWidth: isDarkMode ? 0 : 1,
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: TAB_BAR_PADDING + insets.bottom,
          },
        ],
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: isDarkMode ? 'rgba(255,255,255,0.55)' : '#64748b',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Tasks') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Wellness') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Teams') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen}/>
      <Tab.Screen name="Tasks" component={TasksScreen}/>
      <Tab.Screen name="Calendar" component={CalendarScreen}/>
      <Tab.Screen name="Wellness" component={WellnessScreen}/>
      <Tab.Screen name="Teams" component={TeamsStack}/>
      <Tab.Screen name="Profile" component={ProfileStackScreen}/>
    </Tab.Navigator>
  );

}

// Height of the tab bar itself, not counting the phone's navigation below it
const TAB_BAR_HEIGHT = 65;
const TAB_BAR_PADDING = 8;

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: TAB_BAR_PADDING,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});