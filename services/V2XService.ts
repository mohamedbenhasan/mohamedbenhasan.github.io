import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, Timestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { DENMMessage, DENMEventType, RiskLevel, Coordinates } from '../types';
import { v4 as uuidv4 } from 'uuid';
import ngeohash from 'ngeohash';

const DENM_COLLECTION = 'denm_events';
const MESSAGE_TTL_MS = 60000; // 60 seconds

export class V2XService {
  private static listeners: ((messages: DENMMessage[]) => void)[] = [];
  private static unsubscribe: (() => void) | null = null;
  private static activeMessages: Map<string, DENMMessage> = new Map();

  static getActiveMessages(): DENMMessage[] {
    return Array.from(this.activeMessages.values());
  }

  static async broadcastDENM(
    eventType: DENMEventType,
    location: Coordinates,
    riskLevel: RiskLevel,
    involvedUserIds: string[],
    senderId: string
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      const expiresAt = timestamp + MESSAGE_TTL_MS;
      const geohash = ngeohash.encode(location.lat, location.lng, 7); // ~150m precision

      const message: DENMMessage = {
        id: uuidv4(),
        eventType,
        location,
        timestamp,
        riskLevel,
        involvedUserIds,
        senderId,
        expiresAt,
        geohash
      };

      await addDoc(collection(db, DENM_COLLECTION), message);
      console.log('DENM Broadcasted:', message);
    } catch (error) {
      console.error('Error broadcasting DENM:', error);
    }
  }

  static subscribeToNearbyDENM(
    currentLocation: Coordinates,
    radiusMeters: number,
    callback: (messages: DENMMessage[]) => void
  ): () => void {
    this.listeners.push(callback);

    if (!this.unsubscribe) {
      this.startListening();
    }

    // Immediate callback with current active messages
    callback(Array.from(this.activeMessages.values()));

    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
      if (this.listeners.length === 0 && this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }

  private static startListening() {
    const q = query(
      collection(db, DENM_COLLECTION),
      where('expiresAt', '>', Date.now())
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const newMessages = new Map<string, DENMMessage>();

      snapshot.docs.forEach(doc => {
        const data = doc.data() as DENMMessage;
        if (data.expiresAt > now) {
          newMessages.set(data.id, data);
        }
      });

      this.activeMessages = newMessages;
      this.notifyListeners();
    }, (error) => {
      console.error('Error listening to DENM events:', error);
    });
  }

  private static notifyListeners() {
    const messages = Array.from(this.activeMessages.values());
    this.listeners.forEach(listener => listener(messages));
  }

  static async cleanupExpiredMessages() {
    try {
      const q = query(
        collection(db, DENM_COLLECTION),
        where('expiresAt', '<=', Date.now())
      );
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, DENM_COLLECTION, d.id)));
      await Promise.all(deletePromises);
      if (deletePromises.length > 0) {
        console.log(`Cleaned up ${deletePromises.length} expired DENM messages.`);
      }
    } catch (error) {
      console.error('Error cleaning up DENM messages:', error);
    }
  }
}
