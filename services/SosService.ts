import { collection, query, where, getDocs, setDoc, deleteDoc, doc, serverTimestamp, onSnapshot, updateDoc, increment, writeBatch, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { trustService } from './TrustService';
import { moveCoordinate, getDistance } from '../utils/geo';
import geohash from 'ngeohash';
import { SosCategoryConfig, SosSettings, SosLog, TrustedContact } from '../types';
import emailjs from '@emailjs/browser';

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

export const DEFAULT_SOS_CATEGORIES: SosCategoryConfig[] = [
  { id: 'police', enabled: true, name: 'Police', selectedContactIds: [], channels: ['CALL'], messageTemplate: 'URGENCE (Police) — Je suis en difficulté. Position: {maps_link}. Heure: {time}.' },
  { id: 'ambulance', enabled: true, name: 'Ambulance', selectedContactIds: [], channels: ['CALL'], messageTemplate: 'URGENCE MEDICALE — J\'ai besoin d\'une ambulance. Position: {maps_link}. Heure: {time}.' },
  { id: 'fire', enabled: true, name: 'Pompiers', selectedContactIds: [], channels: ['CALL'], messageTemplate: 'URGENCE (Pompiers) — Incendie/Secours. Position: {maps_link}. Heure: {time}.' },
  { id: 'family', enabled: true, name: 'Ami/Famille', selectedContactIds: [], channels: ['SMS', 'EMAIL'], messageTemplate: 'URGENCE (Famille/Ami) — Je suis en difficulté. Position: {maps_link}. Heure: {time}.' },
  { id: 'assistance', enabled: true, name: 'Assistance', selectedContactIds: [], channels: ['CALL'], messageTemplate: 'URGENCE (Assistance) — J\'ai besoin d\'aide. Position: {maps_link}. Heure: {time}.' }
];

export const DEFAULT_SOS_SETTINGS: SosSettings = {
  categories: DEFAULT_SOS_CATEGORIES,
  liveLocationEnabled: true,
  liveLocationDurationMinutes: 15,
  antiFalseClick: true,
  antiFalseClickType: 'SLIDER',
  securityCheckInEnabled: false,
  securityCheckInMinutes: 10
};

class SosService {
  
  // --- Legacy General SOS functionality (Map Broadcast) ---
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

  public subscribeToActiveSos(centerLat: number, centerLng: number, radiusMeters: number, callback: (alerts: SosAlertCombined[]) => void) {
    const q = query(collection(db, 'sos_alerts'), where('status', '==', 'active'));

    return onSnapshot(q, async (snapshot) => {
      const results: SosAlertCombined[] = [];
      const now = Date.now();

      for (const alertDoc of snapshot.docs) {
        const pubData = alertDoc.data();
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

        const myUid = auth.currentUser?.uid;
        if (myUid && (myUid === alert.userId || alert.trustedViewerIds.includes(myUid))) {
          try {
            const privSnap = await getDocs(query(collection(db, `sos_alerts/${alert.id}/private`)));
            if (!privSnap.empty) {
              alert.privateInfo = privSnap.docs[0].data() as SosAlertPrivate;
            }
          } catch(e) { }
        }

        if (alert.userId !== myUid) {
          if (alert.privateInfo) {
            const dist = getDistance({lat: centerLat, lng: centerLng}, {lat: alert.privateInfo.lat, lng: alert.privateInfo.lng}) * 1000;
            if (dist <= Math.max(radiusMeters, 5000)) {
              results.push(alert);
            }
          } else {
            const myGh = geohash.encode(centerLat, centerLng, 6);
            if (myGh.substring(0, 4) === alert.geohash6.substring(0, 4)) {
              results.push(alert);
            }
          }
        } else {
          results.push(alert);
        }
      }

      callback(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sos_alerts');
    });
  }

  // --- New Settings & Categorized SOS Features ---

  public subscribeToSosSettings(callback: (settings: SosSettings) => void) {
    if (!auth.currentUser) return () => {};
    const myUid = auth.currentUser.uid;
    const ref = doc(db, 'users', myUid, 'settings', 'sos');

    return onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Merge with defaults to ensure new fields are present
        const settings: SosSettings = {
          ...DEFAULT_SOS_SETTINGS,
          ...data,
          categories: data.categories || DEFAULT_SOS_CATEGORIES
        };
        callback(settings);
      } else {
        callback(DEFAULT_SOS_SETTINGS);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${myUid}/settings/sos`));
  }

  public async updateSosSettings(settings: SosSettings) {
    if (!auth.currentUser) throw new Error("Not logged in");
    const myUid = auth.currentUser.uid;
    const ref = doc(db, 'users', myUid, 'settings', 'sos');
    await setDoc(ref, settings, { merge: true });
  }

  public generateSosMessage(template: string, categoryName: string, lat?: number, lng?: number): string {
    const time = new Date().toLocaleTimeString();
    const mapsLink = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : 'Non disponible';
    const name = auth.currentUser?.displayName || 'Moi';
    
    return template
      .replace(/{name}/g, name)
      .replace(/{category}/g, categoryName)
      .replace(/{time}/g, time)
      .replace(/{gps_lat}/g, lat ? lat.toString() : 'N/A')
      .replace(/{gps_lng}/g, lng ? lng.toString() : 'N/A')
      .replace(/{maps_link}/g, mapsLink);
  }

  public async triggerCategorizedSos(categoryId: string, lat?: number, lng?: number, options?: {vruType?: string}): Promise<{ urls: string[] }> {
    if (!auth.currentUser) throw new Error("Not logged in");
    const myUid = auth.currentUser.uid;

    // Fetch settings and contacts to execute SOS
    const setSnap = await getDocs(query(collection(db, 'users', myUid, 'settings')));
    let settings = DEFAULT_SOS_SETTINGS;
    setSnap.forEach(d => { if(d.id === 'sos') settings = d.data() as SosSettings; });

    const category = settings.categories.find(c => c.id === categoryId);
    if (!category) throw new Error("Category not found");

    const message = this.generateSosMessage(category.messageTemplate, category.name, lat, lng);
    
    const contactSnap = await getDocs(query(collection(db, 'users', myUid, 'personal_contacts')));
    const allContacts: TrustedContact[] = [];
    contactSnap.forEach(c => allContacts.push({ id: c.id, ...c.data() } as TrustedContact));

    const targetContacts = allContacts.filter(c => category.selectedContactIds.includes(c.id));
    const urlsToOpen: string[] = [];
    const usedChannels = new Set<'SMS' | 'EMAIL' | 'CALL' | 'IN_APP'>();

    // If live location enabled, maybe we trigger the legacy SOS Map sharing as an "IN_APP" broadcast
    if (settings.liveLocationEnabled && lat && lng && options?.vruType) {
      await this.triggerSos(lat, lng, options.vruType);
      usedChannels.add('IN_APP');
    }

    // Prepare actions for each contact based on preferred channel fallback
    for (const contact of targetContacts) {
      // Prioritize EMAIL over SMS if configured in channels and contact has email
      if (category.channels.includes('EMAIL') && contact.email) {
        // Envoyer l'email via EmailJS
        try {
          const env = (import.meta as any).env;
          const serviceId = env.VITE_EMAILJS_SERVICE_ID;
          const templateId = env.VITE_EMAILJS_TEMPLATE_ID;
          const publicKey = env.VITE_EMAILJS_PUBLIC_KEY;

          if (!serviceId || !templateId || !publicKey) {
            throw new Error("Les identifiants EmailJS sont manquants dans les variables d'environnement (.env).");
          }

          // Variables communément attendues par un template SOS par défaut.
          const templateParams = {
            to_email: contact.email,
            to_name: contact.name,
            from_name: auth.currentUser?.displayName || "Un utilisateur VRU",
            subject: `🚨 URGENCE SOS: ${category.name}`,
            message: message,
            maps_link: lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : 'Non disponible'
          };

          await emailjs.send(serviceId, templateId, templateParams, {
             publicKey: publicKey
          });

          usedChannels.add('EMAIL');
        } catch (e) {
          console.error("Échec de l'envoi de l'email via EmailJS:", e);
          // Fallback avec lien mailto
          urlsToOpen.push(`mailto:${contact.email}?subject=URGENCE SOS&body=${encodeURIComponent(message)}`);
          usedChannels.add('EMAIL');
        }
      } else if (category.channels.includes('SMS') && contact.phone) {
        // Fallback to SMS
        urlsToOpen.push(`sms:${contact.phone}?body=${encodeURIComponent(message)}`);
        usedChannels.add('SMS');
      } else if (category.channels.includes('CALL') && contact.phone) {
        urlsToOpen.push(`tel:${contact.phone}`);
        usedChannels.add('CALL');
      }
    }

    // Log the action
    try {
      await addDoc(collection(db, 'users', myUid, 'sos_logs'), {
        timestamp: serverTimestamp(),
        categoryId,
        recipientIds: targetContacts.map(c => c.id),
        status: urlsToOpen.length > 0 || usedChannels.has('IN_APP') ? 'sent' : 'failed',
        channelsUsed: Array.from(usedChannels)
      });
    } catch(e) { console.error("Failed to log SOS", e); }

    // Returning URLs to let the UI open them (especially tel: and sms:)
    return { urls: urlsToOpen };
  }
}

export const sosService = new SosService();
