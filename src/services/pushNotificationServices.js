import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// ---------------------------------------------------------------------------
// Notification presentation while app is foregrounded
// ---------------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SCHEDULED_MAP_KEY = 'balanse_scheduled_notifications'; // { [taskId]: notificationId }

// ---------------------------------------------------------------------------
// Permissions + push token registration
// ---------------------------------------------------------------------------

/**
 * Requests notification permissions and returns an Expo push token.
 * Safe to call multiple times (e.g. on every app load / login).
 * Returns null on simulators/emulators or if permission is denied.
 */
export const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c3aed',
    });
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permission not granted.');
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
};

/**
 * Saves the Expo push token to the user's Firestore doc so a backend
 * (or Cloud Function, if added later) could target this device.
 * Not required for local notifications, but useful to have on record.
 */
export const savePushTokenToFirestore = async (userId, token) => {
  if (!userId || !token) return false;
  try {
    await setDoc(doc(db, 'users', userId), { pushToken: token }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
};

/** Convenience: registers for push + saves token in one call. Call after login. */
export const setupPushNotifications = async (userId) => {
  const token = await registerForPushNotificationsAsync();
  if (token && userId) {
    await savePushTokenToFirestore(userId, token);
  }
  return token;
};

// ---------------------------------------------------------------------------
// Immediate local notifications (conflicts, wellness alerts)
// ---------------------------------------------------------------------------

/**
 * Fires a local notification right away (fires within a couple seconds).
 * Use for events detected while the app is open: conflicts, wellness status.
 */
export const sendImmediateNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null, // null trigger = fire immediately
    });
    return true;
  } catch (error) {
    console.error('Error sending immediate notification:', error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Scheduled local notifications (deadline reminders)
// ---------------------------------------------------------------------------

const getScheduledMap = async () => {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setScheduledMap = async (map) => {
  try {
    await AsyncStorage.setItem(SCHEDULED_MAP_KEY, JSON.stringify(map));
  } catch (error) {
    console.error('Error persisting scheduled notification map:', error);
  }
};

// Fixed time of day (24h clock) that reminders fire at, the evening before the
// deadline — easier to demo predictably than an exact "24 hours before" offset,
// which can land at odd hours (e.g. 6 AM) depending on the task's deadline time.
const REMINDER_HOUR = 20; // 8:00 PM
const REMINDER_MINUTE = 0;

/**
 * Schedules a local deadline reminder for a task, fired at REMINDER_HOUR:REMINDER_MINUTE
 * on the day before its deadline (or immediately if that time has already passed but
 * the deadline itself hasn't). Cancels any previous reminder for the same task first,
 * so this is safe to call on both create and edit.
 */
export const scheduleDeadlineReminder = async (task) => {
  if (!task?.id || !task?.deadline) return null;

  await cancelDeadlineReminder(task.id);

  const deadline = new Date(task.deadline);
  if (isNaN(deadline.getTime())) return null;

  const now = new Date();
  const reminderTime = new Date(deadline);
  reminderTime.setDate(reminderTime.getDate() - 1);
  reminderTime.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);

  // If reminder time already passed but deadline hasn't, fire in 5s (edge case:
  // task created/edited close to its deadline). If deadline itself already passed, skip.
  let trigger;
if (deadline <= now) {
  return null;
} else if (reminderTime <= now) {
  trigger = { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 };
} else {
  trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime };
}

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Deadline approaching',
        body: `"${task.title}" is due soon.`,
        data: { taskId: task.id, type: 'deadline' },
        sound: true,
      },
      trigger,
    });

    const map = await getScheduledMap();
    map[task.id] = notificationId;
    await setScheduledMap(map);

    return notificationId;
  } catch (error) {
    console.error('Error scheduling deadline reminder:', error);
    return null;
  }
};

/** Cancels a previously scheduled deadline reminder for a task, if one exists. */
export const cancelDeadlineReminder = async (taskId) => {
  if (!taskId) return;
  const map = await getScheduledMap();
  const notificationId = map[taskId];
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error cancelling deadline reminder:', error);
    }
    delete map[taskId];
    await setScheduledMap(map);
  }
};