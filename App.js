// Eto yung root ng app
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth'; // Eto yung naghahandle pag mga nag log-in or log-out
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
const navigationRef = createNavigationContainerRef();

// The notification types BALANSE sends. Anything else is ignored.
const NOTIFICATION_TYPES = ['deadline', 'conflict', 'team', 'wellness'];

// Where a tapped notification should take the user, based on the data the
// notification was sent with.
const goToNotificationTarget = (data) => {
  if ((data.type === 'deadline' || data.type === 'conflict') && data.taskId) {
    navigationRef.navigate('MainApp', { screen: 'Tasks', params: { openTaskId: data.taskId } });
  } else if (data.type === 'team' && data.teamId) {
    navigationRef.navigate('TeamBoard', { teamId: data.teamId, teamName: '', openTaskId: data.taskId });
  } else if (data.type === 'wellness') {
    navigationRef.navigate('MainApp', { screen: 'Wellness' });
  } else {
    navigationRef.navigate('Notifications');
  }
};


// Email/password accounts must open the link sent to their inbox first.
// Google accounts are already verified by Google.
const canEnterApp = (u) =>
  !!u && (u.emailVerified || u.providerData.some((p) => p.providerId === 'google.com'));

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (signedInUser) => {
      // An unverified account stays on the login screens.
      const currentUser = canEnterApp(signedInUser) ? signedInUser : null;
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

  // A tapped notification is kept here until the app is ready to open it:
  // signed in, and with the navigation set up.
  const pendingNotificationRef = useRef(null);

  const openPendingNotification = () => {
    const data = pendingNotificationRef.current;
    if (!data || !canEnterApp(auth.currentUser) || !navigationRef.isReady()) return;
    pendingNotificationRef.current = null;
    try {
      goToNotificationTarget(data);
    } catch (error) {
      console.error('Could not open notification target:', error);
    }
  };

  // Handles what happens when the user taps a notification
  useEffect(() => {
    const handleResponse = (response) => {
      if (!response) return;
      Notifications.clearLastNotificationResponse(); // so it isn't opened again on the next launch
      const data = response.notification?.request?.content?.data;
      // Some Android phones report a normal app launch as a notification tap,
      // with unrelated launch data. Only BALANSE's own notifications have a type.
      if (!NOTIFICATION_TYPES.includes(data?.type)) return;
      pendingNotificationRef.current = data;
      openPendingNotification();
    };

    // The app was closed and opened by tapping a notification
    handleResponse(Notifications.getLastNotificationResponse());

    // The app was already open or in the background
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);

  // Open a waiting notification once the user is signed in and the screens exist
  useEffect(() => {
    if (!loading && user) openPendingNotification();
  }, [loading, user]);

  if (loading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider> 
    <NavigationContainer ref={navigationRef} onReady={openPendingNotification}>
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