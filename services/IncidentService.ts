import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import * as L from 'leaflet';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Incident, IncidentType, IncidentSeverity, Coordinates } from '../types';
import * as geofire from 'geofire-common';

class IncidentService {
  private listeners: Map<string, () => void> = new Map();
  private activeIncidents: Incident[] = [];
  private updateCallbacks: Set<(incidents: Incident[]) => void> = new Set();

  public setOnIncidentsUpdate(callback: (incidents: Incident[]) => void): () => void {
    this.updateCallbacks.add(callback);
    callback(this.activeIncidents);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  private notifyIncidentCallbacks() {
    this.updateCallbacks.forEach((cb) => {
      try {
        cb(this.activeIncidents);
      } catch (err) {
        console.error('Error in incidents callback:', err);
      }
    });
  }

  public unsubscribeAll() {
    this.listeners.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // Ignore errors when cleaning up stale listeners
      }
    });
    this.listeners.clear();
    this.activeIncidents = [];
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
      throw new Error('Must be authenticated to report an incident');
    }

    const geohash = geofire.geohashForLocation([location.lat, location.lng]);
    const now = Date.now();
    const expiresAt = now + ttlHours * 60 * 60 * 1000;

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
      reportsCount: 0,
    };

    try {
      const docRef = await addDoc(collection(db, 'incidents'), incidentData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'incidents');
      throw error;
    }
  }

  public subscribeToIncidentsInBounds(_bounds: L.LatLngBounds): () => void {
    // Clear existing listener
    if (this.listeners.has('main')) {
      try {
        this.listeners.get('main')!();
      } catch {
        // ignore cleanup error
      }
      this.listeners.delete('main');
    }

    if (!auth.currentUser) {
      this.activeIncidents = [];
      this.notifyIncidentCallbacks();
      return () => {};
    }

    const q = query(collection(db, 'incidents'), where('status', '==', 'active'));

    try {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const now = Date.now();
          const incidents: Incident[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.expiresAt > now) {
              incidents.push({
                id: docSnap.id,
                ...data,
              } as Incident);
            }
          });

          this.activeIncidents = incidents;
          this.notifyIncidentCallbacks();
        },
        (error) => {
          if (!auth.currentUser) {
            this.unsubscribeAll();
            return;
          }
          handleFirestoreError(error, OperationType.LIST, 'incidents');
        }
      );

      this.listeners.set('main', unsubscribe);
      return () => {
        if (this.listeners.get('main') === unsubscribe) {
          this.listeners.delete('main');
        }
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      };
    } catch (error) {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'incidents');
      }
      return () => {};
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
        upvotes: increment(1),
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
        reportsCount: increment(1),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  }
}

export const incidentService = new IncidentService();
