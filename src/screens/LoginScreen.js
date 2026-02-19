import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Easing,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';

// Optional gradient import. If you didn't install the lib, the component falls back.
let LinearGradient;
try {
  LinearGradient = require('react-native-linear-gradient').default;
} catch (e) {
  LinearGradient = null;
}

/**
 * Refreshed color palette – deeper teal with a touch of warmth
 */
const COLORS = {
  bgTop: '#E6FCFB',
  bgBottom: '#B2F0EF',
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Entrance sequence animations
  const animLogo = useRef(new Animated.Value(0)).current;
  const animBrand = useRef(new Animated.Value(0)).current;
  const animTitle = useRef(new Animated.Value(0)).current;
  const animInputs = useRef(new Animated.Value(0)).current;
  const animEmail = useRef(new Animated.Value(0)).current;
  const animPass = useRef(new Animated.Value(0)).current;
  const animButton = useRef(new Animated.Value(0)).current;

  // Orb drift
  const orb1 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb2 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb3 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Floating label + focus animations for email
  const emailLabel = useRef(new Animated.Value(email ? 1 : 0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;

  // Floating label + focus animations for password
  const passLabel = useRef(new Animated.Value(password ? 1 : 0)).current;
  const passFocus = useRef(new Animated.Value(0)).current;

  // small horizontal shake for invalid input feedback
  const shake = useRef(new Animated.Value(0)).current;
  const shakeInputs = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) =>
      setPrefersReducedMotion(reduced)
    );

    // Ordered entrance: logo -> brand -> title -> inputs -> button
    Animated.sequence([
      Animated.timing(animLogo, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(animBrand, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(animTitle, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.timing(animInputs, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.stagger(120, [
        Animated.timing(animEmail, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(animPass, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      Animated.timing(animButton, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    // Continuous subtle orb drift, skip if reduce-motion
    if (!prefersReducedMotion) {
      const drift = (anim, dx, dy, dur = 10000, delay = 0) =>
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

      const o1 = drift(orb1, 8, -6, 12000, 0);
      const o2 = drift(orb2, -6, 8, 10000, 900);
      const o3 = drift(orb3, 7, 6, 14000, 700);

      o1.start();
      o2.start();
      o3.start();

      return () => {
        o1.stop();
        o2.stop();
        o3.stop();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  // keep labels in sync if value set programmatically
  useEffect(() => {
    Animated.timing(emailLabel, {
      toValue: email ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [email, emailLabel]);

  useEffect(() => {
    Animated.timing(passLabel, {
      toValue: password ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [password, passLabel]);

  const handleLogin = useCallback(async () => {
    setLoginError('');
    if (!email || !password) {
      setLoginError('Email and password are required.');
      shakeInputs();
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setLoginError('');
      // navigate on success if needed
    } catch (err) {
      console.warn('Login failed:', err.message);
      setLoginError('Sign in failed. Check credentials or network.');
      shakeInputs();
    } finally {
      setIsLoading(false);
    }
  }, [email, password]);

  // Label transforms & colors
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

  // border color for focus glow
  const borderColorAnim = (focusAnim) =>
    focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(14,165,164,0.06)', COLORS.glow],
    });

  // button scale on press
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pressIn = useCallback(
    () => Animated.spring(buttonScale, { toValue: 0.98, useNativeDriver: true }).start(),
    [buttonScale]
  );
  const pressOut = useCallback(
    () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start(),
    [buttonScale]
  );

  // Inner content (the actual login form)
  const renderContent = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Background orbs as gentle watercolor washes */}
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
              opacity: animInputs,
              transform: [
                { translateY: animInputs.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                { translateX: shake },
              ],
            },
          ]}
        >
          {/* Logo */}
          <Animated.View
            style={{
              alignItems: 'center',
              marginBottom: 8,
              opacity: animLogo,
              transform: [
                {
                  translateY: animLogo.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
                },
              ],
            }}
          >
            <View style={[styles.logoCircle, { backgroundColor: COLORS.primary }]}>
              <Text style={[styles.logoText, { color: '#fff' }]}>◐</Text>
            </View>
          </Animated.View>

          {/* Brand */}
          <Animated.Text
            style={[
              styles.brand,
              {
                color: COLORS.textMain,
                opacity: animBrand,
                transform: [
                  {
                    translateY: animBrand.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
                  },
                ],
              },
            ]}
          >
            Balanse
          </Animated.Text>

          {/* Title */}
          <Animated.View
            style={{
              width: '100%',
              opacity: animTitle,
              transform: [
                {
                  translateY: animTitle.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
                },
              ],
            }}
          >
            <Text style={[styles.title, { color: COLORS.textMain }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: COLORS.textSub }]}>
              Sign in to continue
            </Text>
          </Animated.View>

          {/* === INPUTS === */}

          {/* Email */}
          <Animated.View
            style={[
              styles.inputGroup,
              {
                opacity: animEmail,
                transform: [
                  {
                    translateY: animEmail.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
                  },
                ],
              },
            ]}
          >
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
                  borderColor: loginError ? COLORS.error : borderColorAnim(emailFocus),
                },
              ]}
            >
              <Text style={[styles.inputIcon, { color: COLORS.textSub }]}>✉️</Text>
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (loginError) setLoginError('');
                }}
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
          </Animated.View>

          {/* Password */}
          <Animated.View
            style={[
              styles.inputGroup,
              {
                marginTop: 12,
                opacity: animPass,
                transform: [
                  {
                    translateY: animPass.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
                  },
                ],
              },
            ]}
          >
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
                  borderColor: loginError ? COLORS.error : borderColorAnim(passFocus),
                },
              ]}
            >
              <Text style={[styles.inputIcon, { color: COLORS.textSub }]}>🔒</Text>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (loginError) setLoginError('');
                }}
                placeholder=""
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
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
              >
                <Text style={{ color: COLORS.accent, fontWeight: '700' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Forgot password */}
            <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={{ color: COLORS.accent, fontSize: 13 }}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Button & link */}
          <Animated.View
            style={{
              width: '100%',
              marginTop: 18,
              opacity: animButton,
              transform: [
                {
                  translateY: animButton.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
                },
              ],
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Animated.View
                style={[styles.buttonWrapper, { transform: [{ scale: buttonScale }] }]}
              >
                {LinearGradient ? (
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.warmAccent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    {isLoading ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.buttonText}>Signing in...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Sign In</Text>
                    )}
                  </LinearGradient>
                ) : (
                  <View style={[styles.button, { backgroundColor: COLORS.primary }]}>
                    {isLoading ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.buttonText}>Signing in...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Sign In</Text>
                    )}
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.linkContainer}>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={[styles.linkText, { color: COLORS.accent }]}>
                  New here?{' '}
                  <Text style={[styles.linkBold, { color: COLORS.textMain }]}>
                    Create account
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* inline error */}
            {loginError ? (
              <Text
                style={{ color: COLORS.error, marginTop: 12, textAlign: 'center' }}
                accessibilityLiveRegion="polite"
              >
                {loginError}
              </Text>
            ) : null}
          </Animated.View>
        </Animated.View>

        {/* breathing space */}
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

  // Fallback solid background
  return <View style={{ flex: 1, backgroundColor: COLORS.bgTop }}>{renderContent()}</View>;
}

/**
 * Styles – updated to remove card container
 */
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },

  // soft watercolor orbs
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

  // content wrapper – no background, no border, no shadow
  content: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
  },

  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: { color: '#fff', fontSize: 30 },

  brand: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
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

  // inputs
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

  // button
  buttonWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
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
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
  },
  linkBold: {
    fontWeight: '700',
  },
});