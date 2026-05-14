import { db, auth } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';

let heartbeatInterval: NodeJS.Timeout | null = null;

export const presenceService = {
  startHeartbeat: () => {
    if (heartbeatInterval) return;

    const updatePresence = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const publicProfileRef = doc(db, 'public_profiles', user.uid);
        await setDoc(publicProfileRef, {
          uid: user.uid,
          lastActiveAt: serverTimestamp(),
          online: true,
          displayName: user.displayName || user.email?.split('@')[0] || null,
          displayNameLowercase: (user.displayName || user.email?.split('@')[0] || '').toLowerCase(),
          photoURL: user.photoURL || null
        }, { merge: true });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    // Initial update
    updatePresence();

    // Update every 30 seconds
    heartbeatInterval = setInterval(updatePresence, 30000);
  },

  stopHeartbeat: () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    // Set offline when stopping
    const user = auth.currentUser;
    if (user) {
      const publicProfileRef = doc(db, 'public_profiles', user.uid);
      updateDoc(publicProfileRef, {
        online: false,
        lastActiveAt: serverTimestamp()
      }).catch(console.error);
    }
  }
};
