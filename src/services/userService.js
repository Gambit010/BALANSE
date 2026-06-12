import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';

// Upsert the current user's profile so they can be found by email for team invites.
// Called on every login/auth state change. Uses merge so it never wipes existing data.
export const upsertUserProfile = async (user) => {
  if (!user) return;
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        email: user.email || '',
        emailLower: (user.email || '').toLowerCase(),
        displayName:
          user.displayName ||
          (user.email ? user.email.split('@')[0] : 'Student'),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error upserting user profile:', error);
  }
};

// Find a user by email (for inviting to a team).
// Returns { uid, email, displayName } or null if not found.
export const findUserByEmail = async (email) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('emailLower', '==', email.trim().toLowerCase())
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0].data();
    return { uid: d.uid, email: d.email, displayName: d.displayName };
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
};