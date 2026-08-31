import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define light and dark color themes
export const themes = {
  dark: {
    background: '#0f0f23',
    card: '#1a1a3e',
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.3)',
    border: 'rgba(255,255,255,0.08)',
    accent: '#a78bfa',
    inputBg: 'rgba(88,28,135,0.4)',
    tabBar: '#1a1a2e',
    icon: '#ffffff',
  },
  light: {
    background: '#f1f5f9',
    card: '#ffffff',
    text: '#1e293b',
    subtext: '#64748b',
    border: '#e2e8f0',
    accent: '#7c3aed',
    inputBg: '#f8fafc',
    tabBar: '#ffffff',
    icon: '#1e293b',
  },
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // default dark

  // Load saved preference on startup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem('darkMode');
        if (saved !== null) {
          setIsDarkMode(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  // Toggle and save preference
  const toggleDarkMode = async (value) => {
    setIsDarkMode(value);
    try {
      await AsyncStorage.setItem('darkMode', JSON.stringify(value));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = isDarkMode ? themes.dark : themes.light;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme anywhere in the app
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};