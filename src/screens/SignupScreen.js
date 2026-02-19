// SignupScreen.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';

// Optional gradient – if you use expo-linear-gradient it will be available
let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  LinearGradient = null;
}

/**
 * Refreshed color palette – matches LoginScreen
 */
const COLORS = {
  bgTop: '#E6FCFB',
  bgBottom: '#B2F0EF',
  card: 'rgba(255,255,255,0.96)',
  cardBorder: 'rgba(6,182,212,0.2)',
  primary: '#0B7A77',
  accent: '#0891B2',
  warmAccent: '#F59E0B',
  glow: '#2DD4BF',
  textMain: '#022022',
  textSub: '#256D6A',
  inputBg: 'rgba(6,182,212,0.08)',
  placeholder: 'rgba(5,50,52,0.4)',
  error: '#D35400',
  success: '#059669',
};

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Floating label + focus animations
  const emailLabel = useRef(new Animated.Value(email ? 1 : 0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passLabel = useRef(new Animated.Value(password ? 1 : 0)).current;
  const passFocus = useRef(new Animated.Value(0)).current;
  const confirmLabel = useRef(new Animated.Value(confirmPassword ? 1 : 0)).current;
  const confirmFocus = useRef(new Animated.Value(0)).current;

  // Drift orbs (same as Login)
  const orb1 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb2 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb3 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Shake for error feedback
  const shake = useRef(new Animated.Value(0)).current;
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -5, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 3, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  // Button press scale
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pressIn = useCallback(
    () => Animated.spring(buttonScale, { toValue: 0.98, useNativeDriver: true }).start(),
    []
  );
  const pressOut = useCallback(
    () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start(),
    []
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) =>
      setPrefersReducedMotion(reduced)
    );

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 560,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 520,
        useNativeDriver: true,
      }),
    ]).start();

    if (!prefersReducedMotion) {
      const drift = (anim, dx, dy, dur = 12000, delay = 0) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: { x: dx, y: dy },
              duration: dur,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.quad),
              delay,
            }),
            Animated.timing(anim, {
              toValue: { x: -dx, y: -dy },
              duration: dur,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.quad),
            }),
            Animated.timing(anim, {
              toValue: { x: 0, y: 0 },
              duration: dur / 2,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.quad),
            }),
          ])
        );

      const o1 = drift(orb1, 12, -8, 14000, 0);
      const o2 = drift(orb2, -8, 10, 10000, 900);
      const o3 = drift(orb3, 10, 6, 16000, 800);

      o1.start();
      o2.start();
      o3.start();

      return () => {
        o1.stop();
        o2.stop();
        o3.stop();
      };
    }
  }, [prefersReducedMotion]);

  // Keep labels in sync
  useEffect(() => {
    Animated.timing(emailLabel, {
      toValue: email ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [email]);

  useEffect(() => {
    Animated.timing(passLabel, {
      toValue: password ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [password]);

  useEffect(() => {
    Animated.timing(confirmLabel, {
      toValue: confirmPassword ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [confirmPassword]);

  const validateAndSignup = useCallback(async () => {
    setSignupError('');
    if (!email || !password || !confirmPassword) {
      setSignupError('Please fill in all fields.');
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setSignupError('Passwords do not match.');
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setSignupError('Password must be at least 6 characters.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // optionally navigate or show success UI
    } catch (error) {
      console.warn('Signup error:', error.message);
      setSignupError('Signup failed. Try a different email or check your network.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }, [email, password, confirmPassword]);

  // Label transforms & colors (same as Login)
  const labelTransform = (labelAnim) => ({
    transform: [
      {
        translateY: labelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, -8],
        }),
      },
      {
        scale: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
      },
    ],
  });
  const labelColor = (labelAnim) =>
    labelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(37,109,106,0.65)', COLORS.primary],
    });
  const borderColorAnim = (focusAnim) =>
    focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(14,165,164,0.06)', COLORS.glow],
    });

  // Inner form content – now without the card container
  const renderContent = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button – positioned absolutely */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backText, { color: COLORS.textMain }]}>←</Text>
        </TouchableOpacity>

        {/* Background orbs */}
        <Animated.View
          style={[styles.orb1, { transform: orb1.getTranslateTransform(), opacity: 0.28 }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.orb2, { transform: orb2.getTranslateTransform(), opacity: 0.18 }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.orb3, { transform: orb3.getTranslateTransform(), opacity: 0.14 }]}
          pointerEvents="none"
        />

        {/* Content – no card, directly on gradient */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { translateX: shake }],
            },
          ]}
        >
          {/* Logo */}
          <View style={[styles.logoCircle, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.logoText}>◐</Text>
          </View>

          <Text style={[styles.brand, { color: COLORS.textMain }]}>Balanse</Text>

          <Text style={[styles.title, { color: COLORS.textMain }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: COLORS.textSub }]}>Join us today</Text>

          {/* Email input with floating label */}
          <View style={styles.inputGroup}>
            <Animated.Text
              style={[
                styles.floatingLabel,
                labelTransform(emailLabel),
                { color: labelColor(emailLabel) },
              ]}
              pointerEvents="none"
            >
              Email
            </Animated.Text>
            <Animated.View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: COLORS.inputBg,
                  borderColor: signupError ? COLORS.error : borderColorAnim(emailFocus),
                },
              ]}
            >
              <Text style={[styles.inputIcon, { color: COLORS.textSub }]}>✉️</Text>
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (signupError) setSignupError('');
                }}
                placeholder="you@school.edu"
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: COLORS.textMain }]}
                onFocus={() => {
                  Animated.timing(emailFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  Animated.timing(emailLabel, {
                    toValue: 1,
                    duration: 160,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(emailFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  if (!email)
                    Animated.timing(emailLabel, {
                      toValue: 0,
                      duration: 160,
                      useNativeDriver: false,
                    }).start();
                }}
                accessibilityLabel="Email input"
              />
            </Animated.View>
          </View>

          {/* Password input */}
          <View style={styles.inputGroup}>
            <Animated.Text
              style={[
                styles.floatingLabel,
                labelTransform(passLabel),
                { color: labelColor(passLabel) },
              ]}
              pointerEvents="none"
            >
              Password
            </Animated.Text>
            <Animated.View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: COLORS.inputBg,
                  borderColor: signupError ? COLORS.error : borderColorAnim(passFocus),
                },
              ]}
            >
              <Text style={[styles.inputIcon, { color: COLORS.textSub }]}>🔒</Text>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (signupError) setSignupError('');
                }}
                placeholder="••••••••"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry={!showPassword}
                style={[styles.input, { color: COLORS.textMain }]}
                onFocus={() => {
                  Animated.timing(passFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  Animated.timing(passLabel, {
                    toValue: 1,
                    duration: 160,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(passFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  if (!password)
                    Animated.timing(passLabel, {
                      toValue: 0,
                      duration: 160,
                      useNativeDriver: false,
                    }).start();
                }}
                accessibilityLabel="Password input"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((s) => !s)}
                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={{ color: COLORS.accent, fontWeight: '700' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Confirm Password input */}
          <View style={styles.inputGroup}>
            <Animated.Text
              style={[
                styles.floatingLabel,
                labelTransform(confirmLabel),
                { color: labelColor(confirmLabel) },
              ]}
              pointerEvents="none"
            >
              Confirm Password
            </Animated.Text>
            <Animated.View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: COLORS.inputBg,
                  borderColor: signupError ? COLORS.error : borderColorAnim(confirmFocus),
                },
              ]}
            >
              <Text style={[styles.inputIcon, { color: COLORS.textSub }]}>🔒</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  if (signupError) setSignupError('');
                }}
                placeholder="••••••••"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry={!showConfirmPassword}
                style={[styles.input, { color: COLORS.textMain }]}
                onFocus={() => {
                  Animated.timing(confirmFocus, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  Animated.timing(confirmLabel, {
                    toValue: 1,
                    duration: 160,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(confirmFocus, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  if (!confirmPassword)
                    Animated.timing(confirmLabel, {
                      toValue: 0,
                      duration: 160,
                      useNativeDriver: false,
                    }).start();
                }}
                accessibilityLabel="Confirm password input"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((s) => !s)}
                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                }
              >
                <Text style={{ color: COLORS.accent, fontWeight: '700' }}>
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* inline error */}
          {signupError ? (
            <Text
              style={{ color: COLORS.error, marginBottom: 12, textAlign: 'center' }}
              accessibilityLiveRegion="polite"
            >
              {signupError}
            </Text>
          ) : null}

          {/* Sign Up button with gradient */}
          <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onPress={validateAndSignup}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              <View style={styles.buttonWrapper}>
                {LinearGradient ? (
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.warmAccent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    {isLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Creating...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Create Account</Text>
                    )}
                  </LinearGradient>
                ) : (
                  <View style={[styles.button, { backgroundColor: COLORS.primary }]}>
                    {isLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Creating...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Create Account</Text>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Link to Sign in */}
          <TouchableOpacity
            style={styles.linkContainer}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text style={[styles.linkText, { color: COLORS.accent }]}>
              Already have one?{' '}
              <Text style={[styles.linkBold, { color: COLORS.textMain }]}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Outer container – background gradient if available, else solid color
  if (LinearGradient) {
    return (
      <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={{ flex: 1 }}>
        {renderContent()}
      </LinearGradient>
    );
  }
  return <View style={{ flex: 1, backgroundColor: COLORS.bgTop }}>{renderContent()}</View>;
}

/**
 * Styles – updated to remove card container and adjust spacing
 */
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  // Background orbs (same as Login)
  orb1: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(6,182,212,0.18)',
    top: -140,
    right: -120,
    blurRadius: 12,
  },
  orb2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(6,182,212,0.12)',
    bottom: 160,
    left: -100,
  },
  orb3: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(34,193,195,0.10)',
    bottom: -70,
    right: 70,
  },

  backButton: {
    position: 'absolute',
    top: 40,
    left: 18,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: { fontSize: 18, fontWeight: '600' },

  // Content wrapper (no card background)
  content: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    // No background, border, shadow – just the elements on the gradient
    paddingVertical: 26,
    paddingHorizontal: 20,
  },

  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: { color: '#fff', fontSize: 30 },

  brand: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },

  // Inputs (floating label style)
  inputGroup: {
    marginTop: 6,
    marginBottom: 2,
    width: '100%',
  },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    top: 8,
    fontSize: 14,
    fontWeight: '600',
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputIcon: {
    marginRight: 8,
    fontSize: 16,
    opacity: 0.95,
    color: '#4fa7a4',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 4,
  },

  // Button
  buttonWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },

  linkContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
  },
  linkBold: {
    fontWeight: '700',
  },
});