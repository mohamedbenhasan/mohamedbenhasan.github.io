import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocFromServer, getDocs, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Lazy & safe Storage accessor so missing storage registration never crashes app boot
let cachedStorage: FirebaseStorage | null = null;
export async function getFirebaseStorage(): Promise<FirebaseStorage | null> {
  if (cachedStorage) return cachedStorage;
  if (!firebaseConfig.storageBucket) return null;
  try {
    const { getStorage } = await import('firebase/storage');
    cachedStorage = getStorage(app);
    return cachedStorage;
  } catch (err) {
    console.warn('Firebase Storage unavailable in current runtime:', err);
    return null;
  }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

// Error Handling Helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isPermissionError = error instanceof Error ? error.message.includes('Missing or insufficient permissions') : String(error).includes('Missing or insufficient permissions');
  const isAlreadyExistsError = error instanceof Error ? error.message.includes('Document already exists') : String(error).includes('Document already exists');
  
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  if (isPermissionError && !auth.currentUser) {
    console.warn('Firestore Error during logout ignored:', JSON.stringify(errInfo));
    return;
  }

  if (isAlreadyExistsError) {
    console.warn('Firestore Document Already Exists Warning:', JSON.stringify(errInfo));
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
