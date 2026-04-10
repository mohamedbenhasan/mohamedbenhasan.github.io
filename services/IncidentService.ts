import { collection, addDoc, query, where, getDocs, onSnapshot, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Incident, IncidentType, IncidentSeverity, Coordinates } from '../types';
import * as geofire from 'geofire-common';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class IncidentService {
  private listeners: Map<string, () => void> = new Map();
  private activeIncidents: Incident[] = [];
  private onIncidentsUpdateCallback: ((incidents: Incident[]) => void) | null = null;

  public setOnIncidentsUpdate(callback: (incidents: Incident[]) => void) {
    this.onIncidentsUpdateCallback = callback;
    callback(this.activeIncidents);
  }

  public async reportIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    location: Coordinates,
    ttlHours: number,
    description?: string,
    photoUrl?: string
  ): Promise<string> {
    if (!auth.currentUser) {
      throw new Error("Must be authenticated to report an incident");
    }

    const geohash = geofire.geohashForLocation([location.lat, location.lng]);
    const now = Date.now();
    const expiresAt = now + (ttlHours * 60 * 60 * 1000);

    const incidentData = {
      type,
      severity,
      description: description || '',
      location,
      geohash,
      createdAt: now,
      createdByUserId: auth.currentUser.uid,
      expiresAt,
      status: 'active',
      photoUrl: photoUrl || '',
      upvotes: 0,
      reportsCount: 0
    };

    try {
      const docRef = await addDoc(collection(db, 'incidents'), incidentData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'incidents');
      throw error;
    }
  }

  public subscribeToIncidentsInBounds(bounds: L.LatLngBounds) {
    // For simplicity, we'll just fetch active incidents that haven't expired.
    // In a real large-scale app, we'd use geohash queries here.
    
    // Clear existing listener
    if (this.listeners.has('main')) {
      this.listeners.get('main')!();
    }

    const now = Date.now();
    const q = query(
      collection(db, 'incidents'),
      where('status', '==', 'active'),
      where('expiresAt', '>', now)
    );

    try {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const incidents: Incident[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          incidents.push({
            id: doc.id,
            ...data
          } as Incident);
        });
        
        this.activeIncidents = incidents;
        if (this.onIncidentsUpdateCallback) {
          this.onIncidentsUpdateCallback(this.activeIncidents);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'incidents');
      });

      this.listeners.set('main', unsubscribe);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
    }
  }

  public getActiveIncidents(): Incident[] {
    return this.activeIncidents;
  }

  public async upvoteIncident(incidentId: string) {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'incidents', incidentId);
      await updateDoc(docRef, {
        upvotes: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  }

  public async reportSpam(incidentId: string) {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'incidents', incidentId);
      await updateDoc(docRef, {
        reportsCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  }
}

export const incidentService = new IncidentService();
