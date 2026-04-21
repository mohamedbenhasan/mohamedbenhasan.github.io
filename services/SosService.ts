import { collection, query, where, getDocs, setDoc, deleteDoc, doc, serverTimestamp, onSnapshot, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { trustService } from './TrustService';
import { moveCoordinate, getDistance } from '../utils/geo';
import geohash from 'ngeohash';

export interface SosAlertPublic {
  id: string; // docId
  userId: string;
  vruType: string;
  geohash6: string;
  trustedViewerIds: string[];
  status: 'active' | 'resolved' | 'cancelled';
  reportsCount: number;
  createdAt: number;
  expiresAt: number;
}

export interface SosAlertPrivate {
  ownerId: string;
  lat: number;
  lng: number;
  displayName?: string;
}

export type SosAlertCombined = SosAlertPublic & { privateInfo?: SosAlertPrivate };

class SosService {
  
  public async triggerSos(lat: number, lng: number, vruType: string) {
    if (!auth.currentUser) throw new Error("Unauthenticated");
    const myUid = auth.currentUser.uid;
    const displayName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || "User";

    // 1. Fetch Trusted Contact Ids
    const trustedIds = await trustService.getAcceptedContactIds();
    
    // 2. Generate partial geohash (length 6 ~ 600mx1.2km)
    const gh6 = geohash.encode(lat, lng, 6);
    
    // 3. Current time & expiresAt
    const now = Date.now();
    const expiresAt = now + (15 * 60 * 1000); // 15 mins

    // 4. Batch write public + private info
    const batch = writeBatch(db);
    
    const alertRef = doc(collection(db, 'sos_alerts'));
    batch.set(alertRef, {
      userId: myUid,
      vruType,
      geohash6: gh6,
      trustedViewerIds: trustedIds,
      status: 'active',
      reportsCount: 0,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt
    });
    
    const privateRef = doc(db, `sos_alerts/${alertRef.id}/private/info`);
    batch.set(privateRef, {
      ownerId: myUid,
      lat,
      lng,
      displayName
    });

    // We can also rate-limit here by updating userProfile, but for MVP let's trust the rules/UI
    try {
      await batch.commit();
      return alertRef.id;
    } catch (e) {
      console.error(e);
      throw new Error("Failed to trigger SOS.");
    }
  }

  public async resolveSos(alertId: string) {
    try {
      await updateDoc(doc(db, 'sos_alerts', alertId), {
        status: 'resolved'
      });
    } catch(e) {
      console.error(e);
    }
  }

  // Subscribe to SOS Alerts happening around the user
  public subscribeToActiveSos(centerLat: number, centerLng: number, radiusMeters: number, callback: (alerts: SosAlertCombined[]) => void) {
    // For simplicity without pure geo-queries, fetch all active, then filter client-side.
    // In production, use geohash range queries on `geohash6`.
    
    // Let's just fetch active ones
    const now = Date.now();
    const q = query(
      collection(db, 'sos_alerts'),
      where('status', '==', 'active')
    );

    return onSnapshot(q, async (snapshot) => {
      const results: SosAlertCombined[] = [];
      const now = Date.now();

      for (const alertDoc of snapshot.docs) {
        const pubData = alertDoc.data();
        // Ignore expired
        if (pubData.expiresAt < now) continue;

        const alert: SosAlertCombined = {
          id: alertDoc.id,
          userId: pubData.userId,
          vruType: pubData.vruType,
          geohash6: pubData.geohash6,
          trustedViewerIds: pubData.trustedViewerIds || [],
          status: pubData.status,
          reportsCount: pubData.reportsCount,
          createdAt: pubData.createdAt?.toMillis ? pubData.createdAt.toMillis() : pubData.createdAt,
          expiresAt: pubData.expiresAt
        };

        // Do we have access to private info?
        const myUid = auth.currentUser?.uid;
        if (myUid && (myUid === alert.userId || alert.trustedViewerIds.includes(myUid))) {
          try {
            const privSnap = await getDocs(query(collection(db, `sos_alerts/${alert.id}/private`)));
            if (!privSnap.empty) {
              alert.privateInfo = privSnap.docs[0].data() as SosAlertPrivate;
            }
          } catch(e) { /* Should not fail if rules are correct, but safe fallback */ }
        }

        // Distance check filtering if it's not my alert
        if (alert.userId !== myUid) {
          if (alert.privateInfo) {
            // we have exact location
            const dist = getDistance({lat: centerLat, lng: centerLng}, {lat: alert.privateInfo.lat, lng: alert.privateInfo.lng}) * 1000;
            if (dist <= Math.max(radiusMeters, 5000)) { // show up to 5km for trusted
              results.push(alert);
            }
          } else {
            // we only have approximate
            const decoded = geohash.decode(alert.geohash6);
            // distance function might not exist in ngeohash, let's use a rough calc or just string matching on geohash
            // Using geohash string prefix matching for simplicity - if first 4 chars match, it's very close (~20km)
            const myGh = geohash.encode(centerLat, centerLng, 6);
            if (myGh.substring(0, 4) === alert.geohash6.substring(0, 4)) {
              results.push(alert);
            }
          }
        } else {
          // always show my own alerts
          results.push(alert);
        }
      }

      callback(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sos_alerts');
    });
  }

}

export const sosService = new SosService();
