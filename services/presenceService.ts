import { db, auth } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { resolveApiUrl } from '../utils/apiClient';

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let lastInteractionAt = Date.now();
let listenersAttached = false;
const sessionId =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const IDLE_THRESHOLD_MS = 60_000;

function recordInteraction() {
  lastInteractionAt = Date.now();
}

function attachInteractionListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach((evt) => {
    window.addEventListener(evt, recordInteraction, { passive: true });
  });
  window.addEventListener('beforeunload', () => {
    const user = auth.currentUser;
    const offlineUrl = resolveApiUrl('/api/presence/offline');
    if (!user || !offlineUrl) return;
    user.getIdToken().then((token) => {
      try {
        fetch(offlineUrl, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // ignore unload failures
      }
    }).catch(() => {});
  });
}

function computeClientState(): 'online' | 'idle' {
  if (typeof document !== 'undefined' && document.hidden) {
    return 'idle';
  }
  return Date.now() - lastInteractionAt > IDLE_THRESHOLD_MS ? 'idle' : 'online';
}

export const presenceService = {
  startHeartbeat: () => {
    attachInteractionListeners();
    if (heartbeatInterval) return;

    const updatePresence = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const state = computeClientState();

      // 1. Authoritative backend heartbeat
      try {
        const heartbeatUrl = resolveApiUrl('/api/presence/heartbeat');
        if (heartbeatUrl) {
          const token = await user.getIdToken();
          await fetch(heartbeatUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              state,
              lastInteractionAt,
              sessionId,
              currentPage: typeof window !== 'undefined' ? window.location.pathname : '/',
            }),
          });
        }
      } catch {
        // Non-blocking heartbeat error
      }

      // 2. Mirror lightweight online status to Firestore public_profiles
      try {
        const publicProfileRef = doc(db, 'public_profiles', user.uid);
        await setDoc(
          publicProfileRef,
          {
            uid: user.uid,
            lastActiveAt: serverTimestamp(),
            online: state === 'online',
            displayName: user.displayName || user.email?.split('@')[0] || null,
            displayNameLowercase: (
              user.displayName ||
              user.email?.split('@')[0] ||
              ''
            ).toLowerCase(),
            photoURL: user.photoURL || null,
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    updatePresence();
    heartbeatInterval = setInterval(updatePresence, 20_000);
  },

  stopHeartbeat: async () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    const user = auth.currentUser;
    if (user) {
      try {
        const offlineUrl = resolveApiUrl('/api/presence/offline');
        if (offlineUrl) {
          const token = await user.getIdToken();
          await fetch(offlineUrl, {
            method: 'POST',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionId }),
          });
        }
      } catch {
        // ignore
      }

      try {
        const publicProfileRef = doc(db, 'public_profiles', user.uid);
        await updateDoc(publicProfileRef, {
          online: false,
          lastActiveAt: serverTimestamp(),
        });
      } catch {
        // ignore
      }
    }
  },
};
