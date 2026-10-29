import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

// Saves the current user's own profile (name and email). Called on every
// login/auth state change. Uses merge so it never wipes existing data.
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