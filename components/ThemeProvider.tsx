import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('vruguard-theme') as Theme;
    return saved || 'system';
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = theme === 'dark' || (theme === 'system' && systemPrefersDark);
    
    setIsDark(isDarkMode);

    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Sync with Firestore when auth changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const fetchTheme = async () => {
          try {
            const docRef = doc(db, 'users', user.uid, 'settings', 'display');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().theme) {
              const firestoreTheme = docSnap.data().theme as Theme;
              setThemeState(firestoreTheme);
              localStorage.setItem('vruguard-theme', firestoreTheme);
            }
          } catch (error) {
            console.error("Error fetching theme from firestore", error);
          }
        };
        fetchTheme();
      }
    });
    return () => unsubscribe();
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('vruguard-theme', newTheme);
    
    if (auth.currentUser) {
      try {
         const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'display');
         const docSnap = await getDoc(docRef);
         if (docSnap.exists()) {
             await updateDoc(docRef, { theme: newTheme });
         } else {
             await setDoc(docRef, { theme: newTheme }, { merge: true });
         }
      } catch (error) {
         console.error("Error saving theme to firestore", error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
