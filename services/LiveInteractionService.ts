import { collection, doc, setDoc, addDoc, serverTimestamp, query, orderBy, startAt, endAt, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
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
    if (!auth.currentUser) return;
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
    if (!auth.currentUser) {
      onUpdate([]);
      return () => {};
    }
    const bounds = geofire.geohashQueryBounds(center, radiusInM);
    const unsubscribes: (() => void)[] = [];
    
    // Track matching documents per doc.id, then emit unique users keyed by userId
    const docResults = new Map<string, LiveLocation>();

    const emitUniqueUsers = () => {
      const byUserId = new Map<string, LiveLocation>();
      docResults.forEach((loc) => {
        const prev = byUserId.get(loc.userId);
        const prevTs = prev?.timestamp?.toMillis?.() ?? 0;
        const nextTs = loc.timestamp?.toMillis?.() ?? 0;
        if (!prev || nextTs >= prevTs) {
          byUserId.set(loc.userId, loc);
        }
      });
      onUpdate(Array.from(byUserId.values()));
    };

    for (const b of bounds) {
      const q = query(
        collection(db, 'live_locations'),
        orderBy('geohash'),
        startAt(b[0]),
        endAt(b[1])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const docSnap = change.doc;
          const raw = docSnap.data() as Partial<LiveLocation>;
          const normalizedUserId = raw.userId || docSnap.id;

          if (change.type === 'removed' || typeof raw.lat !== 'number' || typeof raw.lng !== 'number') {
            docResults.delete(docSnap.id);
          } else {
            const data: LiveLocation = {
              userId: normalizedUserId,
              lat: raw.lat,
              lng: raw.lng,
              geohash: raw.geohash || '',
              timestamp: raw.timestamp as Timestamp,
              type: raw.type || 'PEDESTRIAN',
            };

            // Filter out false positives (geohash bounds are rectangular, radius is circular)
            const distanceInKm = geofire.distanceBetween([data.lat, data.lng], center);
            const distanceInM = distanceInKm * 1000;

            // Also filter out stale locations (older than 2 minutes)
            const now = Date.now();
            const timestamp = data.timestamp?.toMillis?.() || now;
            const isStale = (now - timestamp) > 2 * 60 * 1000;

            if (distanceInM <= radiusInM && !isStale) {
              docResults.set(docSnap.id, data);
            } else {
              docResults.delete(docSnap.id);
            }
          }
        });

        emitUniqueUsers();
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
    if (!auth.currentUser) return;
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
    if (!auth.currentUser) {
      onUpdate([]);
      return () => {};
    }
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
