import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';

import { toLocalDateKey } from '../utils/dateUtils';

export { toLocalDateKey }; // ProfileScreen still imports it from here

// Private subcollection (like the push token), since users/{uid} itself is
// readable by teammates for invite lookups.
const activityRef = (uid) => doc(db, 'users', uid, 'private', 'activity');

// Marks today as active. When a task ID is passed, it's also saved to the
// list of tasks ever completed, so an achievement stays earned even after
// the task is deleted or reopened. arrayUnion keeps each ID only once.
export const recordActiveDay = async (uid, completedTaskId) => {
  if (!uid) return;
  try {
    const update = { activeDays: arrayUnion(toLocalDateKey()) };
    if (completedTaskId) update.completedTaskIds = arrayUnion(completedTaskId);
    await setDoc(activityRef(uid), update, { merge: true });
  } catch (error) {
    console.error('Error recording active day:', error);
  }
};

export const getActivity = async (uid) => {
  const empty = { activeDays: [], completedTaskIds: [] };
  if (!uid) return empty;
  try {
    const snap = await getDoc(activityRef(uid));
    if (!snap.exists()) return empty;
    const data = snap.data();
    return {
      activeDays: data.activeDays || [],
      completedTaskIds: data.completedTaskIds || [],
    };
  } catch (error) {
    console.error('Error fetching activity:', error);
    return empty;
  }
};

export const getActiveDays = async (uid) => (await getActivity(uid)).activeDays;