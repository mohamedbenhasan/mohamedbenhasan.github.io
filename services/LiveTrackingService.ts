import { 
  collection, 
  doc, 
  addDoc,
  updateDoc, 
  onSnapshot, 
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

export interface LiveTrackingSession {
  id?: string;
  userId: string;
  token: string;
  active: boolean;
  createdAt: number;
  expiresAt: number;
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: number;
  };
}

class LiveTrackingService {
  private activeSessionId: string | null = null;
  private unsubscribeFromSession: (() => void) | null = null;
  private autoStopTimeout: NodeJS.Timeout | null = null;

  // For User A: Creates a new tracking session
  public async createSession(durationHours: number = 2): Promise<string> {
    if (!auth.currentUser) throw new Error("User must be authenticated");
    
    // Stop any existing session
    await this.stopSession();

    const now = Date.now();
    const token = uuidv4() + '-' + Date.now().toString(36); // Unique token (which we can use as document ID or as a field)
    const expiresAt = now + (durationHours * 60 * 60 * 1000);

    const sessionData = {
      userId: auth.currentUser.uid,
      token,
      active: true,
      createdAt: now,
      expiresAt
    };

    try {
      const docRef = await addDoc(collection(db, 'live_tracking_sessions'), sessionData);
      this.activeSessionId = docRef.id;

      // Automatically set a timeout to clean up / stop locally
      const msUntilExpiry = expiresAt - now;
      this.autoStopTimeout = setTimeout(() => {
        this.stopSession();
      }, msUntilExpiry);

      // Return the shareable link
      const baseUrl = window.location.origin;
      return `${baseUrl}/?live_track=${docRef.id}&t=${token}`;
    } catch (error) {
      console.error("Failed to create live tracking session:", error);
      throw error;
    }
  }

  // Updates the current active session with new location from User A
  public async updateLocation(lat: number, lng: number) {
    if (!this.activeSessionId || !auth.currentUser) return;
    
    try {
      await updateDoc(doc(db, 'live_tracking_sessions', this.activeSessionId), {
        lastLocation: {
          lat,
          lng,
          timestamp: Date.now()
        }
      });
    } catch (e) {
      console.error("Failed to update tracking location:", e);
    }
  }

  // User A stops sharing
  public async stopSession() {
    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }

    if (!this.activeSessionId || !auth.currentUser) return;

    try {
      await updateDoc(doc(db, 'live_tracking_sessions', this.activeSessionId), {
        active: false
      });
    } catch (e) {
      console.error("Failed to stop tracking session:", e);
    } finally {
      this.activeSessionId = null;
    }
  }

  // Listen to my active sessions (to restore state on reload)
  public async getMyActiveSession(): Promise<LiveTrackingSession | null> {
    if (!auth.currentUser) return null;
    try {
      const q = query(
        collection(db, 'live_tracking_sessions'),
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      // Filter by expiry locally just in case
      let validSession = null;
      const now = Date.now();
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as LiveTrackingSession;
        if (data.expiresAt > now && data.active) {
          validSession = { ...data, id: docSnap.id };
          this.activeSessionId = docSnap.id;
        } else if (data.active) {
          // Expired but not marked inactive, mark it now
          updateDoc(doc(db, 'live_tracking_sessions', docSnap.id), { active: false });
        }
      });
      return validSession;
    } catch (e) {
      console.error("Failed to get active session:", e);
      return null;
    }
  }

  // -----------------------------------------------------
  // For User B: Subscribe to a shared session
  // -----------------------------------------------------
  public subscribeToSession(sessionId: string, token: string, onUpdate: (session: LiveTrackingSession | null) => void): () => void {
    const docRef = doc(db, 'live_tracking_sessions', sessionId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as LiveTrackingSession;
        // Verify token matches and active
        const now = Date.now();
        if (data.token === token && data.active && data.expiresAt > now) {
          onUpdate({ ...data, id: docSnap.id });
        } else {
          // Inactive, expired, or invalid token
          onUpdate(null);
        }
      } else {
        onUpdate(null);
      }
    }, (err) => {
      console.error("Tracking subscription error:", err);
      // Let's assume a missing permissions error means we need to stop or it's invalid.
      // E.g. rule blocked "allow get" because active is false, or similar.
      onUpdate(null); 
    });

    return unsubscribe;
  }
}

export const liveTrackingService = new LiveTrackingService();
