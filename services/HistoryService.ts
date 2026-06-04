import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SimulationState, User, OptimizationContext } from '../types';

export interface SessionRecord {
  id: string;
  timestamp: string;
  duration: number; // seconds
  user: User;
  context: OptimizationContext;
  metrics: {
    avgError: number;
    collisionWarnings: number;
    quantumFusionActive: boolean;
  };
  summary?: string;
  userId?: string; // Added for querying
}

export const historyService = {
  async getHistory(userId: string): Promise<SessionRecord[]> {
    try {
      const q = query(
        collection(db, 'sessions'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamp to ISO string if needed
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
        } as SessionRecord;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'sessions');
      return [];
    }
  },

  async saveSession(session: SessionRecord) {
    try {
      await addDoc(collection(db, 'sessions'), {
        ...session,
        userId: session.user.id, // Ensure userId is set for querying
        timestamp: serverTimestamp() // Use server timestamp
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
    }
  }
};
