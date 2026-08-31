import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { sendImmediateNotification } from './pushNotificationServices';

// Get all notifications for current user
export const getUserNotifications = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

// Mark notification as read
export const markAsRead = async (notifId) => {
  try {
    const notifRef = doc(db, 'notifications', notifId);
    await updateDoc(notifRef, { isRead: true });
    return true;
  } catch (error) {
    console.error('Error marking notification:', error);
    return false;
  }
};

// Create a notification
export const createNotification = async (userId, message, type) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      message,
      type,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

// Get unread count
export const getUnreadCount = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.length;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Check if a notification with the same message already exists recently (24h window)
export const hasRecentNotification = async (userId, message) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('message', '==', message)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return false;

    // Check if any of the matches were created within the last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return snapshot.docs.some((doc) => {
      const data = doc.data();
      if (!data.createdAt || !data.createdAt.toMillis) return false;
      return data.createdAt.toMillis() > dayAgo;
    });
  } catch (error) {
    console.error('Error checking recent notifications:', error);
    return false; // Fail open — don't block notification creation on error
  }
};
// Check for approaching deadlines and create notifications
export const checkDeadlineNotifications = async (userId, tasks) => {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const incompleteTasks = tasks.filter(t => t.progress < 100 && t.deadline);

    for (const task of incompleteTasks) {
      const deadline = new Date(task.deadline);
      if (isNaN(deadline.getTime())) continue;

      // Skip if already past deadline (overdue is handled elsewhere)
      if (deadline <= now) continue;

      let message = null;

      if (deadline <= in24h) {
        message = `"${task.title}" is due in less than 24 hours`;
      } else if (deadline <= in48h) {
        message = `"${task.title}" is due in less than 48 hours`;
      }

      if (message) {
        const alreadyNotified = await hasRecentNotification(userId, message);
        if (!alreadyNotified) {
          await createNotification(userId, message, 'deadline');
          await sendImmediateNotification('Deadline approaching', message, {
            type: 'deadline',
            taskId: task.id,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking deadline notifications:', error);
  }
};