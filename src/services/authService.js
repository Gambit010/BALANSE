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