import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../../firebase';

GoogleSignin.configure({
  webClientId: "434339829705-io1susotd428mps3d7en622aae4go42e.apps.googleusercontent.com",
  offlineAccess: true,
});

export const handleGoogleSignIn = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    await GoogleSignin.signOut();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken || userInfo.idToken;
    
    if (!idToken) throw new Error('No ID token returned');
    
    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(auth, credential);
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Sign in cancelled');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign in already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Play services not available');
    }
    throw error;
  }
};

export const handleGoogleSignOut = async () => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.log('Google sign out error:', error)
  }
};

// Google Sign-In is a NATIVE module and does NOT work in Expo Go.
// This stub lets the app run in Expo Go without crashing.
//
// To re-enable Google Sign-In later, restore the native implementation
// (GoogleSignin.configure + signIn) and run a development build
// (npx expo run:android / EAS build) instead of Expo Go.

/*
export const handleGoogleSignIn = async () => {
  throw new Error(
    'Google Sign-In is unavailable in Expo Go. Please use email/password login, ' +
    'or build a development client to enable Google Sign-In.'
  );
};
*/