import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { RiskScore, VRU } from '../types';

export const firebaseService = {
  saveRiskData: async (userId: string, riskScore: RiskScore, vru: VRU, modelUsed: string) => {
    try {
      await addDoc(collection(db, 'risk_data'), {
        userId,
        score: riskScore.value,
        level: riskScore.level,
        timestamp: serverTimestamp(),
        location: {
          lat: vru.position.lat,
          lng: vru.position.lng
        },
        modelUsed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'risk_data');
    }
  },

  saveTrackingData: async (userId: string, vru: VRU) => {
    try {
      await addDoc(collection(db, 'tracking_data'), {
        userId,
        timestamp: serverTimestamp(),
        location: {
          lat: vru.position.lat,
          lng: vru.position.lng
        },
        velocity: {
          x: vru.velocity.x,
          y: vru.velocity.y
        },
        heading: vru.heading
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tracking_data');
    }
  },

  saveFeedback: async (uid: string, type: 'RECOMMENDATION' | 'SIMULATION', rating?: number, comment?: string, recommendationText?: string, context?: any) => {
    try {
      await addDoc(collection(db, 'feedback'), {
        uid,
        type,
        rating,
        comment,
        recommendationText,
        timestamp: serverTimestamp(),
        context
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'feedback');
    }
  },

  saveInfrastructureAlert: async (userId: string, vru: VRU, infraType: string, safetyLevel: string, message: string) => {
    try {
      await addDoc(collection(db, 'infrastructure_alerts'), {
        userId,
        timestamp: serverTimestamp(),
        location: {
          lat: vru.position.lat,
          lng: vru.position.lng
        },
        vruType: vru.type,
        infraType,
        safetyLevel,
        message
      });
      // In a real app, this could trigger a Cloud Function to send an FCM push notification
      console.log(`[FCM Mock] Sending push notification to ${userId}: ${message}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'infrastructure_alerts');
    }
  }
};
