import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import {
  isValidEmailFormat,
  isAllowedDomain,
  isValidName,
  isValidPasswordLength,
  isValidMiddleName,
  areSignupFieldsFilled,
} from '../constants/validation';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth } from '../../firebase';
import { Ionicons } from '@expo/vector-icons';
import { handleGoogleSignIn } from '../services/authService'; // for react native google sign in

export default function SignupScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSignup = async () => {
    if (!areSignupFieldsFilled(firstName, lastName, email, password)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isValidName(firstName)) {
      Alert.alert('Error', 'First name should only contain letters');
      return;
    }

    if (!isValidMiddleName(middleName)) {
      Alert.alert('Error', 'Middle name should only contain letters');
      return;
    }

    if (!isValidName(lastName)) {
      Alert.alert('Error', 'Last name should only contain letters');
      return;
    }

    if (!isValidEmailFormat(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!isAllowedDomain(email)) {
      Alert.alert(
        'Error',
        'Please use a Gmail, Yahoo, Outlook, or STI email'
      );
      return;
    }

    if (!isValidPasswordLength(password)) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    

    const fullName = middleName
    ? `${firstName} ${middleName} ${lastName}`
    : `${firstName} ${lastName}`;

    setIsLoading(true);
      try {
      // await createUserWithEmailAndPassword(auth, email, password);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: fullName,
      });

      await sendEmailVerification(userCredential.user);

      await auth.signOut();

      Alert.alert(
        'Account Created',
        `Welcome, ${firstName}! Please log in to continue`,
        //`Welcome, ${firstName}! A verification email has been sent to ${email}. Please verify your email before logging in`,
        [{ text: 'Go to Login', onPress: () => navigation.navigate('Login') }]
      );

    } catch (error) {
      let message = 'Something went wrong. Please try again';
      if (error.code === 'auth/email-already-in-use') message = 'This email is registered';
      if (error.code === 'auth/invalid-email') message = 'Please enter a valid email address';
      Alert.alert('Signup Failed', message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <LinearGradient
      colors={['#8b5cf6', '#ec4899']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.brandName}>BALANSE</Text>
            <Text style={styles.welcomeText}>Start your journey to productivity</Text>
          </View>

          {/* Glass Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.cardTitle}>Create Account</Text>

            {/* First Name */}
            <Text style={styles.label}>First Name <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>

            {/* Middle Name */}
            <Text style={styles.label}>Middle Name <Text style={styles.optional}>(Optional)</Text></Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your middle name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={middleName}
                onChangeText={setMiddleName}
              />
            </View>

            {/* Last Name */}
            <Text style={styles.label}>Last Name <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password<Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Create a strong password"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="rgba(255, 255, 255, 0.7)"
                />
              </TouchableOpacity>
            </View>

            {/* Create Account Button */}
            <TouchableOpacity 
              style={[styles.createButton, isLoading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              <Text style={styles.createButtonText}>
                {isLoading ? 'Creating...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <TouchableOpacity
               style={styles.socialButton}
               onPress={async () => {
                 try {
                   const userCredential = await handleGoogleSignIn();
                   Alert.alert (
                    'Account Created',
                    `Signed in as ${userCredential.user.displayName || 'User'}`
                   );
                 } catch (error) {
                   console.log('Google Error:', error);
                   Alert.alert('Error', error.message || 'Google sign-in failed');
                 }
               }}
            >
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialButtonText}>Continue with Microsoft</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom Link */}
          <TouchableOpacity 
            style={styles.bottomLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.bottomText}>
              Already have an account? <Text style={styles.bottomBold}>Log In</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  required:{
    color: '#f87171',
    textTransform: 'none',
  },
  optional:{
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
    textTransform: 'none',
    fontSize: 11,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(88, 28, 135, 0.4)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 12,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  showText: {
    fontSize: 16,
    opacity: 0.7,
  },
  createButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  socialButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  socialButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  bottomText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  bottomBold: {
    color: '#ffffff',
    fontWeight: '700',
  },
});