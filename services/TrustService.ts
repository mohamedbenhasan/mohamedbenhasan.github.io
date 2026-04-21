import { collection, query, where, getDocs, setDoc, deleteDoc, doc, serverTimestamp, onSnapshot, or, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from './conversationsService';

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
}

export const trustService = new TrustService();
