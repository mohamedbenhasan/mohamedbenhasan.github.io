import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface ExitFeedback {
  userId: string;
  rating: number;
  comment?: string;
  categoryTags?: string[];
  metadata?: {
    appVersion?: string;
    vruType?: string;
    userAgent?: string;
  };
}

const EXIT_FEEDBACK_KEY = 'vru_last_exit_feedback';
// 14 days in ms
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export class AppFeedbackService {
  /**
   * Check if the user needs to provide feedback.
   * True if no feedback in last 14 days.
   */
  shouldRequestFeedback(): boolean {
    if (typeof window === 'undefined') return false;
    const lastFeedbackStr = localStorage.getItem(EXIT_FEEDBACK_KEY);
    if (!lastFeedbackStr) return true;
    
    const lastFeedbackTime = parseInt(lastFeedbackStr, 10);
    if (isNaN(lastFeedbackTime)) return true;

    return (Date.now() - lastFeedbackTime) >= FOURTEEN_DAYS_MS;
  }

  /**
   * Submits the exit feedback and marks the timestamp
   */
  async submitExitFeedback(feedback: ExitFeedback): Promise<void> {
    try {
      await addDoc(collection(db, 'app_feedback'), {
        userId: feedback.userId || 'anonymous',
        rating: feedback.rating,
        comment: feedback.comment || '',
        categoryTags: feedback.categoryTags || [],
        metadata: feedback.metadata || {},
        createdAt: serverTimestamp()
      });
      // Mark as submitted
      this.markFeedbackSkippedOrSubmitted();
    } catch (e) {
      console.error('Failed to submit exit feedback', e);
      throw e;
    }
  }

  /**
   * Refreshes the 14-day timeout without submitting anything
   */
  markFeedbackSkippedOrSubmitted() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(EXIT_FEEDBACK_KEY, Date.now().toString());
    }
  }
}

export const appFeedbackService = new AppFeedbackService();
