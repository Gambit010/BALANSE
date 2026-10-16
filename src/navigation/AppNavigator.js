import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // Make sure this is imported
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: '#a78bfa',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
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
          } else if (route.name === 'Teams') { // Now points to the Stack
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
      
      {/* REPLACE THE OLD TEAMS SCREEN WITH THE STACK */}
      <Tab.Screen name="Teams" component={TeamsStack}/>
      
      <Tab.Screen name="Profile" component={ProfileStackScreen}/>
      
      {/* REMOVE THIS LINE COMPLETELY - MyAssignments is now inside TeamsStack */}
      {/* <Tab.Screen name="MyAssignments" ... /> */}
    </Tab.Navigator>
  );

}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 0,
    height: 65,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});