import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';

// Local calendar date, not UTC — toISOString() would file a 7 AM completion
// in the Philippines (UTC+8) under the previous day.
export const toLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Private subcollection (like the push token), since users/{uid} itself is
// readable by teammates for invite lookups.
const activityRef = (uid) => doc(db, 'users', uid, 'private', 'activity');

export const recordActiveDay = async (uid) => {
  if (!uid) return;
  try {
    await setDoc(activityRef(uid), { activeDays: arrayUnion(toLocalDateKey()) }, { merge: true });
  } catch (error) {
    console.error('Error recording active day:', error);
  }
};

export const getActiveDays = async (uid) => {
  if (!uid) return [];
  try {
    const snap = await getDoc(activityRef(uid));
    return snap.exists() ? snap.data().activeDays || [] : [];
  } catch (error) {
    console.error('Error fetching active days:', error);
    return [];
  }
};