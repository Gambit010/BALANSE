import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebase';

// Per account, so a different user on the same phone still sees it once.
export const ONBOARDING_KEY_PREFIX = 'onboarding_seen_';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Everything in one list',
    description: 'Add your school work, org tasks, and personal to-dos. Put in your class schedule too, so it all shows up on one calendar.',
  },
  {
    id: '2',
    title: 'See what to do first',
    description: 'Each task gets a score from its deadline, the priority you pick, and its category. Higher scores go to the top. Tap the score on a task to see how it was counted.',
  },
  {
    id: '3',
    title: 'Spot clashes early',
    description: 'If a task overlaps with a class or another deadline, you\'ll get a warning so you can move things around before it becomes a problem.',
  },
  {
    id: '4',
    title: 'Check in with yourself',
    description: 'Every two weeks, answer five short questions about how you\'ve been feeling. You\'ll get tips based on your answers and can see how your score changes over time.',
  },
];
export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // replace (not navigate) so Android's back button can't return here.
  const finishOnboarding = async () => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${uid}`, 'true');
      } catch (e) {
        console.error('Failed to save onboarding flag:', e);
      }
    }
    navigation.replace('MainApp');
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  const currentSlide = slides[currentIndex];

  return (
    <LinearGradient
      colors={['#8b5cf6', '#ec4899']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandName}>BALANSE</Text>
        <Text style={styles.tagline}>A quick look before you start</Text> 
        
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>

        {/* Title */}
        <Text style={styles.title}>{currentSlide.title}</Text>

        {/* Description */}
        <Text style={styles.description}>{currentSlide.description}</Text>
      </View>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.activeDot,
            ]}
          />
        ))}
      </View>

      {/* Next Button */}
      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>
          {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
        </Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    marginBottom: 12,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textDecorationLine: 'underline',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '700',
  },
});