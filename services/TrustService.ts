import { collection, query, where, getDocs, setDoc, deleteDoc, doc, serverTimestamp, onSnapshot, or, updateDoc, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from './conversationsService';
import { TrustedContact } from '../types';

export interface TrustedConnection {
  id: string; // format: uidA_uidB
  userA: string;
  userB: string;
  initiatorId: string;
  status: 'pending' | 'accepted';
  createdAt: number;
  updatedAt: number;
  // Computed client-side
  otherUser?: any; 
}

class TrustService {
  // --- Platform User Connections ---
  public getConnectionId(uid1: string, uid2: string): string {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  }

  public subscribeToMyConnections(callback: (connections: TrustedConnection[]) => void) {
    if (!auth.currentUser) return () => {};
    const myUid = auth.currentUser.uid;

    const q = query(
      collection(db, 'trusted_connections'),
      or(
        where('userA', '==', myUid),
        where('userB', '==', myUid)
      )
    );

    return onSnapshot(q, async (snapshot) => {
      const connections: TrustedConnection[] = [];
      const userCache = new Map<string, UserProfile>();

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const otherUid = data.userA === myUid ? data.userB : data.userA;
        
        const conn: TrustedConnection = {
          id: docSnap.id,
          userA: data.userA,
          userB: data.userB,
          initiatorId: data.initiatorId,
          status: data.status,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
        };

        // Fetch User Profile
        if (!userCache.has(otherUid)) {
          const uSnap = await getDocs(query(collection(db, 'public_profiles'), where('uid', '==', otherUid)));
          if (!uSnap.empty) {
            userCache.set(otherUid, uSnap.docs[0].data() as UserProfile);
          }
        }
        conn.otherUser = userCache.get(otherUid);
        connections.push(conn);
      }
      callback(connections);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trusted_connections');
    });
  }

  public async getAcceptedContactIds(): Promise<string[]> {
    if (!auth.currentUser) return [];
    const myUid = auth.currentUser.uid;

    try {
      const q = query(
        collection(db, 'trusted_connections'),
        or(
          where('userA', '==', myUid),
          where('userB', '==', myUid)
        )
      );
      
      const snap = await getDocs(q);
      const ids: string[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'accepted') {
          ids.push(data.userA === myUid ? data.userB : data.userA);
        }
      });
      return ids;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  public async sendRequest(targetUid: string) {
    if (!auth.currentUser) throw new Error("Not logged in");
    const myUid = auth.currentUser.uid;
    if (myUid === targetUid) throw new Error("Cannot add yourself");

    const activeContacts = await this.getAcceptedContactIds();
    if (activeContacts.length >= 10) {
      throw new Error("You have reached the maximum number of trusted contacts (10).");
    }

    const connId = this.getConnectionId(myUid, targetUid);
    const userA = myUid < targetUid ? myUid : targetUid;
    const userB = myUid < targetUid ? targetUid : myUid;

    await setDoc(doc(db, 'trusted_connections', connId), {
      userA,
      userB,
      initiatorId: myUid,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  public async acceptRequest(connId: string) {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, 'trusted_connections', connId), {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
  }

  public async removeConnection(connId: string) {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, 'trusted_connections', connId));
  }

  // --- Personal Trusted Contacts (For SOS) ---

  public subscribeToPersonalContacts(callback: (contacts: TrustedContact[]) => void) {
    if (!auth.currentUser) return () => {};
    const myUid = auth.currentUser.uid;
    
    // We will save personal contacts inside user's private data or a top-level collection.
    // Let's use a subcollection: users/{myUid}/personal_contacts
    const q = query(collection(db, 'users', myUid, 'personal_contacts'));

    return onSnapshot(q, (snapshot) => {
      const contacts: TrustedContact[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        contacts.push({
          id: docSnap.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          whatsapp: data.whatsapp,
          relation: data.relation,
          priority: data.priority ?? 0,
          preferredChannel: data.preferredChannel
        });
      });
      callback(contacts.sort((a,b) => b.priority - a.priority));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${myUid}/personal_contacts`);
    });
  }

  public async addPersonalContact(contact: Omit<TrustedContact, 'id'>) {
    if (!auth.currentUser) throw new Error("Not logged in");
    const myUid = auth.currentUser.uid;

    await addDoc(collection(db, 'users', myUid, 'personal_contacts'), {
      ...contact,
      createdAt: serverTimestamp()
    });
  }

  public async updatePersonalContact(id: string, contact: Partial<Omit<TrustedContact, 'id'>>) {
    if (!auth.currentUser) throw new Error("Not logged in");
    const myUid = auth.currentUser.uid;

    await updateDoc(doc(db, 'users', myUid, 'personal_contacts', id), {
      ...contact,
      updatedAt: serverTimestamp()
    });
  }

  public async removePersonalContact(id: string) {
    if (!auth.currentUser) throw new Error("Not logged in");
    const myUid = auth.currentUser.uid;

    await deleteDoc(doc(db, 'users', myUid, 'personal_contacts', id));
  }
}

export const trustService = new TrustService();
