import { collection, doc, setDoc, addDoc, serverTimestamp, query, orderBy, startAt, endAt, onSnapshot, getDocs, Timestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import * as geofire from 'geofire-common';

export interface LiveLocation {
  userId: string;
  lat: number;
  lng: number;
  geohash: string;
  timestamp: Timestamp;
  type: string;
}

export interface AlertEvent {
  id?: string;
  mainUserId: string;
  otherUserId?: string;
  lat: number;
  lng: number;
  geohash: string;
  timestamp: Timestamp;
  riskLevel: string;
  ttc?: number;
  probability?: number;
  mainVruType?: string;
  otherVruType?: string;
}

export const liveInteractionService = {
  // 1. Continuously update user's position
  updateLiveLocation: async (userId: string, lat: number, lng: number, type: string) => {
    try {
      const hash = geofire.geohashForLocation([lat, lng]);
      const docRef = doc(db, 'live_locations', userId);
      await setDoc(docRef, {
        userId,
        lat,
        lng,
        geohash: hash,
        timestamp: serverTimestamp(),
        type
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `live_locations/${userId}`);
    }
  },

  // 2. Detect nearby users within a defined radius
  listenToNearbyUsers: (
    center: [number, number],
    radiusInM: number,
    onUpdate: (users: LiveLocation[]) => void
  ) => {
    const bounds = geofire.geohashQueryBounds(center, radiusInM);
    const promises = [];
    const unsubscribes: (() => void)[] = [];
    
    // We need to keep track of the results from each bound
    const results = new Map<string, LiveLocation>();

    for (const b of bounds) {
      const q = query(
        collection(db, 'live_locations'),
        orderBy('geohash'),
        startAt(b[0]),
        endAt(b[1])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const data = doc.data() as LiveLocation;
          
          if (change.type === 'removed') {
            results.delete(doc.id);
          } else {
            // Filter out false positives (geohash bounds are rectangular, radius is circular)
            const distanceInKm = geofire.distanceBetween([data.lat, data.lng], center);
            const distanceInM = distanceInKm * 1000;
            
            // Also filter out stale locations (older than 2 minutes)
            const now = Date.now();
            const timestamp = data.timestamp?.toMillis() || now;
            const isStale = (now - timestamp) > 2 * 60 * 1000;

            if (distanceInM <= radiusInM && !isStale) {
              results.set(doc.id, data);
            } else {
              results.delete(doc.id);
            }
          }
        });
        
        onUpdate(Array.from(results.values()));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'live_locations');
      });
      
      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  },

  // 3. Trigger an alert event
  triggerAlert: async (mainUserId: string, otherUserId: string | undefined, lat: number, lng: number, riskLevel: string, ttc?: number, probability?: number, mainVruType?: string, otherVruType?: string) => {
    try {
      const hash = geofire.geohashForLocation([lat, lng]);
      await addDoc(collection(db, 'alerts'), {
        mainUserId,
        otherUserId: otherUserId || null,
        lat,
        lng,
        geohash: hash,
        timestamp: serverTimestamp(),
        riskLevel,
        ttc: ttc || null,
        probability: probability || null,
        mainVruType: mainVruType || null,
        otherVruType: otherVruType || null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'alerts');
    }
  },

  // 4. Listen to nearby active alerts
  listenToNearbyAlerts: (
    center: [number, number],
    radiusInM: number,
    onUpdate: (alerts: AlertEvent[]) => void
  ) => {
    const bounds = geofire.geohashQueryBounds(center, radiusInM);
    const unsubscribes: (() => void)[] = [];
    const results = new Map<string, AlertEvent>();

    // To prevent spam, we only care about recent alerts (e.g., last 30 seconds)
    const recentThreshold = Date.now() - 30 * 1000;

    for (const b of bounds) {
      const q = query(
        collection(db, 'alerts'),
        orderBy('geohash'),
        startAt(b[0]),
        endAt(b[1])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const data = doc.data() as AlertEvent;
          data.id = doc.id;
          
          if (change.type === 'removed') {
            results.delete(doc.id);
          } else {
            const distanceInKm = geofire.distanceBetween([data.lat, data.lng], center);
            const distanceInM = distanceInKm * 1000;
            const timestamp = data.timestamp?.toMillis() || Date.now();
            
            // Only include alerts within radius and within the last 30 seconds
            if (distanceInM <= radiusInM && timestamp > recentThreshold) {
              results.set(doc.id, data);
            } else {
              results.delete(doc.id);
            }
          }
        });
        
        onUpdate(Array.from(results.values()));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'alerts');
      });
      
      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }
};
