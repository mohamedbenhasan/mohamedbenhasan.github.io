import { 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  onSnapshot, 
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AlertEvent, LiveLocation } from '../types';

export interface ParentalLink {
  id: string; // The inviteCode is the doc ID
  parentId: string;
  childId: string | null;
  childName: string | null;
  inviteCode: string;
  status: 'pending' | 'active' | 'revoked' | 'paused';
  createdAt: number;
  updatedAt: number;
}

class ParentalService {
  // Generate a random 6-character code
  private generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // --- Parent Actions ---
  
  public async createInviteLink(): Promise<string> {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    // We try to find a unique code
    let code = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      code = this.generateCode();
      const snap = await getDoc(doc(db, 'parental_links', code));
      if (!snap.exists()) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) throw new Error('Could not generate unique invite code');
    
    const now = Date.now();
    const linkData: Omit<ParentalLink, 'id'> = {
      parentId: auth.currentUser.uid,
      childId: null,
      childName: null,
      inviteCode: code,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    
    await setDoc(doc(db, 'parental_links', code), linkData);
    return code;
  }
  
  public subscribeToMyChildren(onUpdate: (links: ParentalLink[]) => void): () => void {
    if (!auth.currentUser) return () => {};
    
    const q = query(
      collection(db, 'parental_links'),
      where('parentId', '==', auth.currentUser.uid),
      where('status', '!=', 'revoked')
    );
    
    return onSnapshot(q, (snapshot) => {
      const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentalLink));
      onUpdate(links);
    }, (err) => {
      console.error("Error subscribing to children:", err);
    });
  }

  public async revokeLink(linkId: string) {
    await updateDoc(doc(db, 'parental_links', linkId), {
      status: 'revoked',
      updatedAt: Date.now()
    });
  }
  
  public async pauseLink(linkId: string, paused: boolean) {
    await updateDoc(doc(db, 'parental_links', linkId), {
      status: paused ? 'paused' : 'active',
      updatedAt: Date.now()
    });
  }

  // Subscribes to child location + alerts
  public subscribeToChildTelemetry(childId: string, 
    onLocationUpdate: (loc: LiveLocation | null) => void,
    onAlertUpdate: (alerts: AlertEvent[]) => void
  ): () => void {
    
    const unsubLocation = onSnapshot(doc(db, 'live_locations', childId), (snap) => {
      if (snap.exists()) {
        onLocationUpdate(snap.data() as LiveLocation);
      } else {
        onLocationUpdate(null);
      }
    });

    const now = Date.now();
    const qAlerts = query(
      collection(db, 'alerts'),
      where('mainUserId', '==', childId)
    );
    const unsubAlerts = onSnapshot(qAlerts, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Client-side sort instead of complex index requirements
        list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onAlertUpdate(list);
    });

    return () => {
      unsubLocation();
      unsubAlerts();
    };
  }

  // --- Child Actions ---

  public async joinFamilyCode(code: string, childName: string): Promise<boolean> {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    const ref = doc(db, 'parental_links', code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error("Code d'invitation invalide ou expiré.");
    }
    
    const data = snap.data() as ParentalLink;
    if (data.status !== 'pending') {
      throw new Error("Ce code d'invitation a déjà été utilisé ou est expiré.");
    }
    
    await updateDoc(ref, {
      childId: auth.currentUser.uid,
      childName: childName || auth.currentUser.displayName || 'Enfant',
      status: 'active',
      updatedAt: Date.now()
    });
    
    return true;
  }
}

export const parentalService = new ParentalService();
