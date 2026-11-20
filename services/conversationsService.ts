import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  onSnapshot,
  orderBy,
  limit,
  setDoc,
  getDoc
} from 'firebase/firestore';

export interface Conversation {
  id: string;
  type: 'direct';
  members: string[];
  membersKey: string;
  createdAt: any;
  updatedAt: any;
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: any;
  };
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  type: 'text';
  status: 'sent' | 'delivered' | 'read';
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  online: boolean;
  lastActiveAt: any;
}

export const conversationsService = {
  // Get or create a direct conversation with another user
  getOrCreateDirectConversation: async (otherUserId: string): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const uids = [currentUser.uid, otherUserId].sort();
    const membersKey = `${uids[0]}_${uids[1]}`;

    // Check if conversation exists
    const q = query(
      collection(db, 'conversations'),
      where('membersKey', '==', membersKey),
      where('members', 'array-contains', currentUser.uid)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    // Create new conversation
    const newConvRef = doc(collection(db, 'conversations'));
    await setDoc(newConvRef, {
      type: 'direct',
      members: uids,
      membersKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return newConvRef.id;
  },

  // Send a message in a conversation
  sendMessage: async (conversationId: string, text: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const messageData = {
      senderId: currentUser.uid,
      text,
      createdAt: serverTimestamp(),
      type: 'text',
      status: 'sent'
    };

    // Add message
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

    // Update conversation lastMessage and updatedAt
    await updateDoc(doc(db, 'conversations', conversationId), {
      updatedAt: serverTimestamp(),
      lastMessage: {
        text,
        senderId: currentUser.uid,
        createdAt: serverTimestamp()
      }
    });
  },

  // Subscribe to user's conversations
  subscribeToConversations: (callback: (conversations: Conversation[]) => void) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return () => {};

    const q = query(
      collection(db, 'conversations'),
      where('members', 'array-contains', currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];
      callback(convs);
    }, (error) => {
      console.error('Firestore Error in conversations:', error);
    });
  },

  // Subscribe to messages in a conversation
  subscribeToMessages: (conversationId: string, callback: (messages: Message[]) => void) => {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      callback(msgs);
    }, (error) => {
      console.error('Firestore Error in conversation messages:', error);
    });
  },

  // Search users by displayName
  searchUsers: async (searchQuery: string): Promise<UserProfile[]> => {
    if (!searchQuery.trim()) return [];
    
    const queryText = searchQuery.toLowerCase();
    
    // Simple prefix search using >= and <=
    const q = query(
      collection(db, 'public_profiles'),
      where('displayNameLowercase', '>=', queryText),
      where('displayNameLowercase', '<=', queryText + '\uf8ff'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => doc.data() as UserProfile)
      .filter(user => user.uid !== auth.currentUser?.uid); // Exclude self
  },

  // Subscribe to online users
  subscribeToOnlineUsers: (callback: (users: UserProfile[]) => void) => {
    const q = query(
      collection(db, 'public_profiles'),
      where('online', '==', true),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(user => user.uid !== auth.currentUser?.uid); // Exclude self
      callback(users);
    });
  },
  
  // Get user profile
  getUserProfile: async (uid: string): Promise<UserProfile | null> => {
    const docRef = doc(db, 'public_profiles', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  }
};
