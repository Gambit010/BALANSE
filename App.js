import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { ThemeProvider } from './src/context/ThemeContext'; // for dark mode 

import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import OnboardingScreen, { ONBOARDING_KEY_PREFIX } from './src/screens/OnboardingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import AddTaskScreen from './src/screens/AddTasksScreen';
import EditTaskScreen from './src/screens/EditTaskScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import AddClassScreen from './src/screens/AddClassScreen';
import TeamBoardScreen from './src/screens/TeamBoardScreen';
import { upsertUserProfile } from './src/services/userService';
import * as Notifications from 'expo-notifications';
import { setupPushNotifications } from './src/services/pushNotificationServices';

const Stack = createStackNavigator();


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Read the flag before setUser, so the first screen is decided correctly.
      if (currentUser) {
        try {
          const seen = await AsyncStorage.getItem(`${ONBOARDING_KEY_PREFIX}${currentUser.uid}`);
          setOnboardingSeen(seen === 'true');
        } catch {
          setOnboardingSeen(false);
        }
      }
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        upsertUserProfile(currentUser);
        setupPushNotifications(currentUser.uid);
      }
    });
    return unsubscribe;
  }, []);

  // Handles what happens when the user taps a notification
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
    });
    return () => subscription.remove();
  }, []);

  if (loading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider> 
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
      >
        {user ? (
          <>
            {!onboardingSeen && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
            <Stack.Screen name="MainApp" component={AppNavigator} />
            <Stack.Screen name="AddTask" component={AddTaskScreen} />
            <Stack.Screen name="AddClass" component={AddClassScreen} />
            <Stack.Screen name="EditTask" component={EditTaskScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
            <Stack.Screen name="TeamBoard" component={TeamBoardScreen} />
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
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}