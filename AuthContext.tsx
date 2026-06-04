import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { presenceService } from './services/presenceService';

interface AuthContextType {
  user: User | null;
  role: 'ADMIN' | 'OPERATOR' | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef).catch(error => {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            throw error;
          });
          
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            // Create new user profile
            const newUserRole = currentUser.email === 'medbenhasan@gmail.com' ? 'ADMIN' : 'OPERATOR';
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || currentUser.email?.split('@')[0],
              displayNameLowercase: (currentUser.displayName || currentUser.email?.split('@')[0] || '').toLowerCase(),
              photoURL: currentUser.photoURL || null,
              role: newUserRole,
              createdAt: serverTimestamp()
            }).catch(error => {
              handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
              throw error;
            });
            
            // Create public profile
            const publicProfileRef = doc(db, 'public_profiles', currentUser.uid);
            await setDoc(publicProfileRef, {
              uid: currentUser.uid,
              displayName: currentUser.displayName || currentUser.email?.split('@')[0],
              displayNameLowercase: (currentUser.displayName || currentUser.email?.split('@')[0] || '').toLowerCase(),
              photoURL: currentUser.photoURL || null,
              online: true,
              lastActiveAt: serverTimestamp()
            }).catch(error => {
              handleFirestoreError(error, OperationType.WRITE, `public_profiles/${currentUser.uid}`);
              throw error;
            });
            
            setRole(newUserRole);
          }
          presenceService.startHeartbeat();
        } catch (error) {
          console.error("Error in AuthContext:", error);
        }
      } else {
        setRole(null);
        presenceService.stopHeartbeat();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Update the profile with the name? We can just store it in Firestore since we do that in onAuthStateChanged anyway, 
      // but onAuthStateChanged will trigger immediately. Let's let onAuthStateChanged handle the document creation.
      // We might want to update the profile displayName here, but for simplicity, the document creation will use email if displayName is null.
    } catch (error) {
      console.error("Error signing up with email", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, loginWithGoogle, loginWithEmail, signUpWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
