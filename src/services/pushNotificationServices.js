import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getDueTime, getReminderTime, getOverdueTime, SNOOZE_MINUTES } from '../utils/reminderUtils';

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

const SCHEDULED_MAP_KEY = 'balanse_scheduled_notifications'; // { [key]: notificationId }, see OVERDUE_KEY
const NOTIFICATIONS_ENABLED_KEY = 'balanse_notifications_enabled';

/** Whether this device should fire local notifications. Defaults to enabled. */
export const getNotificationsEnabled = async () => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
};

export const setNotificationsEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
  } catch (error) {
    console.error('Error persisting notification preference:', error);
  }
};

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
    // Kept in its own document under private/. Teammates need to read it to
    // send team pushes, so the rules open this one document and nothing else.
    await setDoc(doc(db, 'users', userId, 'private', 'pushToken'), { token }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
};

/**
 * Call on logout, before signing out. Phones can be shared, so the next person
 * on this phone must not get this account's team pushes, deadline reminders or
 * leftover notifications. Logging in again saves the token again.
 */
export const clearDeviceNotifications = async (userId) => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
    await AsyncStorage.removeItem(SCHEDULED_MAP_KEY);
  } catch (error) {
    console.error('Error clearing notifications on this phone:', error);
  }
  if (!userId) return;
  // With no internet, a Firestore delete only finishes once the phone is back
  // online, so stop waiting after a few seconds instead of blocking logout.
  try {
    await Promise.race([
      deleteDoc(doc(db, 'users', userId, 'private', 'pushToken')),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch (error) {
    console.error('Error removing push token:', error);
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
/**
 * Sends a REAL remote push notification to a specific Expo push token,
 * via Expo's push API. Unlike sendImmediateNotification/scheduleDeadlineReminder
 * (which only fire on the calling device), this reaches a DIFFERENT device —
 * required for team features, where Person A's action (assigning a task) needs
 * to notify Person B's phone, not Person A's.
 */
export const sendPushToToken = async (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken) return false;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        data,
        sound: 'default',
      }),
    });
    const result = await response.json();
    if (result?.data?.status === 'error') {
      console.error('Expo push send error:', result.data.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending remote push:', error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Immediate local notifications (conflicts, wellness alerts)
// ---------------------------------------------------------------------------

/**
 * Fires a local notification right away (fires within a couple seconds).
 * Use for events detected while the app is open: conflicts, wellness status.
 */
export const sendImmediateNotification = async (title, body, data = {}) => {
  if (!(await getNotificationsEnabled())) return false;
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

// Changes to the saved map run one at a time. Reminders are rescheduled for
// every task right after login, and a snooze can happen at the same moment;
// without this, one save could overwrite the other.
let mapQueue = Promise.resolve();
const updateScheduledMap = (change) => {
  const run = mapQueue.then(async () => {
    const map = await getScheduledMap();
    const result = await change(map);
    await setScheduledMap(map);
    return result;
  });
  mapQueue = run.catch(() => {});
  return run;
};

// Each task can have up to three scheduled notifications, saved in the map as
// "<taskId>" (evening before), "<taskId>:overdue" and "<taskId>:snooze".
const OVERDUE_KEY = (taskId) => `${taskId}:overdue`;
const SNOOZE_KEY = (taskId) => `${taskId}:snooze`;

const cancelKeys = async (map, keys) => {
  for (const key of keys) {
    if (!map[key]) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(map[key]);
    } catch (error) {
      console.error('Error cancelling scheduled notification:', error);
    }
    delete map[key];
  }
};

// Buttons shown on task reminders. Each one opens the app, which then makes
// the change and confirms it; that works even when the app was fully closed.
export const TASK_CATEGORY = 'balanse_task';
export const TASK_ACTIONS = { DONE: 'done', IN_PROGRESS: 'in-progress', SNOOZE: 'snooze' };

/** Call once when the app starts, so reminders show their buttons. */
export const registerTaskNotificationActions = async () => {
  try {
    await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
      { identifier: TASK_ACTIONS.DONE, buttonTitle: 'Done', options: { opensAppToForeground: true } },
      { identifier: TASK_ACTIONS.IN_PROGRESS, buttonTitle: 'In Progress', options: { opensAppToForeground: true } },
      { identifier: TASK_ACTIONS.SNOOZE, buttonTitle: `Snooze ${SNOOZE_MINUTES / 60} hr`, options: { opensAppToForeground: true } },
    ]);
  } catch (error) {
    console.error('Error setting up notification buttons:', error);
  }
};

const taskContent = (task, title, body) => ({
  title,
  body,
  data: { taskId: task.id, type: 'deadline', title: task.title },
  categoryIdentifier: TASK_CATEGORY,
  sound: true,
});

/**
 * Schedules a task's two reminders: "Deadline approaching" at 8:00 PM the
 * evening before, and "Task overdue" once the deadline passes (see
 * reminderUtils). Replaces any earlier ones for the task, so it's safe to call
 * on create, edit and status change. If the evening-before time has already
 * passed but the task isn't due yet, the first reminder fires in 5 seconds,
 * unless allowImmediate is false (used when reminders are set again in bulk).
 */
export const scheduleDeadlineReminder = async (task, { allowImmediate = true } = {}) => {
  if (!task?.id || !task?.deadline) return null;
  if (!(await getNotificationsEnabled())) return null;

  const due = getDueTime(task.deadline);
  if (!due) return null;

  return updateScheduledMap(async (map) => {
    await cancelKeys(map, [task.id, OVERDUE_KEY(task.id)]);
    const now = new Date();
    let reminderId = null;

    try {
      if (due > now) {
        const reminderTime = getReminderTime(task.deadline);
        let trigger = null;
        if (reminderTime > now) {
          trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime };
        } else if (allowImmediate) {
          trigger = { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 };
        }
        if (trigger) {
          reminderId = await Notifications.scheduleNotificationAsync({
            content: taskContent(task, 'Deadline approaching', `"${task.title}" is due soon.`),
            trigger,
          });
          map[task.id] = reminderId;
        }
      }

      const overdueTime = getOverdueTime(task.deadline);
      if (overdueTime > now) {
        map[OVERDUE_KEY(task.id)] = await Notifications.scheduleNotificationAsync({
          content: taskContent(task, 'Task overdue', `"${task.title}" is past its deadline and isn't done yet.`),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: overdueTime },
        });
      }
    } catch (error) {
      console.error('Error scheduling deadline reminder:', error);
    }
    return reminderId;
  });
};

/**
 * "Snooze" on a reminder: shows the same reminder again in SNOOZE_MINUTES.
 * The deadline stays the same; Push Deadline +1 Day in the app changes that.
 */
export const snoozeTaskReminder = async (taskId, content) => {
  if (!taskId || !content) return false;
  return updateScheduledMap(async (map) => {
    await cancelKeys(map, [SNOOZE_KEY(taskId)]);
    try {
      map[SNOOZE_KEY(taskId)] = await Notifications.scheduleNotificationAsync({
        content: {
          title: content.title,
          body: content.body,
          data: content.data,
          categoryIdentifier: TASK_CATEGORY,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SNOOZE_MINUTES * 60 },
      });
      return true;
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      return false;
    }
  });
};

/** Cancels every scheduled reminder for a task (done or deleted). */
export const cancelDeadlineReminder = async (taskId) => {
  if (!taskId) return;
  await updateScheduledMap((map) => cancelKeys(map, [taskId, OVERDUE_KEY(taskId), SNOOZE_KEY(taskId)]));
};
