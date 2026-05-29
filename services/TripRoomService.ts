import { collection, addDoc, query, where, getDocs, onSnapshot, doc, updateDoc, increment, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { TripRoom, TripMessage } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class TripRoomService {
  private currentRoomListener: (() => void) | null = null;

  public async getOrCreateZoneRoom(zoneKey: string): Promise<string> {
    const now = Date.now();
    const q = query(
      collection(db, 'trip_rooms'),
      where('zoneKey', '==', zoneKey)
    );

    try {
      const snapshot = await getDocs(q);
      const validRooms = snapshot.docs.filter(doc => doc.data().activeUntil > now && doc.data().type === 'zone');
      
      if (validRooms.length > 0) {
        return validRooms[0].id;
      }

      // Create new room
      const roomData = {
        type: 'zone',
        zoneKey,
        createdAt: now,
        activeUntil: now + (24 * 60 * 60 * 1000) // 24 hours
      };
      const docRef = await addDoc(collection(db, 'trip_rooms'), roomData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'trip_rooms');
      throw error;
    }
  }

  public async getOrCreateTripRoom(tripId: string): Promise<string> {
    const now = Date.now();
    const q = query(
      collection(db, 'trip_rooms'),
      where('tripId', '==', tripId)
    );

    try {
      const snapshot = await getDocs(q);
      const validRooms = snapshot.docs.filter(doc => doc.data().activeUntil > now && doc.data().type === 'trip');

      if (validRooms.length > 0) {
        return validRooms[0].id;
      }

      // Create new room
      const roomData = {
        type: 'trip',
        tripId,
        createdAt: now,
        activeUntil: now + (12 * 60 * 60 * 1000) // 12 hours
      };
      const docRef = await addDoc(collection(db, 'trip_rooms'), roomData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'trip_rooms');
      throw error;
    }
  }

  public subscribeToMessages(roomId: string, callback: (messages: TripMessage[]) => void) {
    if (this.currentRoomListener) {
      this.currentRoomListener();
    }

    const q = query(
      collection(db, `trip_rooms/${roomId}/messages`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    try {
      this.currentRoomListener = onSnapshot(q, (snapshot) => {
        const messages: TripMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data({ serverTimestamps: 'estimate' });
          messages.push({ 
            id: doc.id, 
            ...data,
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
          } as TripMessage);
        });
        // Sort by createdAt ascending to guarantee chronological order
        messages.sort((a, b) => a.createdAt - b.createdAt);
        callback(messages);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `trip_rooms/${roomId}/messages`);
      });

      return this.currentRoomListener;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `trip_rooms/${roomId}/messages`);
      throw error;
    }
  }

  public async sendMessage(roomId: string, text: string, messageType: 'info' | 'warning' | 'question' = 'info', relatedIncidentId?: string) {
    if (!auth.currentUser) throw new Error("Must be logged in to send a message");

    const messageData = {
      userId: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Anonymous',
      text,
      createdAt: serverTimestamp(),
      messageType,
      ...(relatedIncidentId ? { relatedIncidentId } : {})
    };

    try {
      await addDoc(collection(db, `trip_rooms/${roomId}/messages`), messageData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `trip_rooms/${roomId}/messages`);
      throw error;
    }
  }
}

export const tripRoomService = new TripRoomService();
