import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AppNavigator from './src/navigation/AppNavigator';
import AddTaskScreen from './src/screens/AddTasksScreen';
import EditTaskScreen from './src/screens/EditTaskScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import AddClassScreen from './src/screens/AddClassScreen';
import { upsertUserProfile } from './src/services/userService';

const Stack = createStackNavigator();


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        upsertUserProfile(currentUser);
      }
    });
    return unsubscribe;
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
      >
        {user ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="MainApp" component={AppNavigator} />
            <Stack.Screen name="AddTask" component={AddTaskScreen} />
            <Stack.Screen name="AddClass" component={AddClassScreen} />
            <Stack.Screen name="EditTask" component={EditTaskScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}