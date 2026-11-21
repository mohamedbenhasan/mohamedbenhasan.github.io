import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import geohash from 'ngeohash';

export interface ZoneReview {
  id?: string;
  geohash: string;
  userId: string;
  isAnonymous: boolean;
  rating: number;
  comment?: string;
  tags?: string[];
  timeContext?: 'day' | 'night' | 'unknown';
  createdAt?: any;
}

export interface ZoneStats {
  geohash: string;
  averageRating: number;
  reviewCount: number;
}

export interface CommunityRoute {
  id?: string;
  startAddress: string;
  endAddress: string;
  routePoints: {lat: number, lng: number}[];
  geohashes: string[];
  userId: string;
  timeContext: 'day' | 'night' | 'always';
  mode: 'walk' | 'transport' | 'bike';
  reasons: string[];
  upvotes: number;
  downvotes: number;
  createdAt?: any;
}

export interface RouteVote {
  id?: string;
  routeId: string;
  userId: string;
  vote: 1 | -1;
  timestamp: any;
}

export const zoneSafetyService = {
  // Precision 6 is roughly 1.2km x 600m
  GEOHASH_PRECISION: 6,

  getGeohashForLocation: (lat: number, lng: number) => {
    return geohash.encode(lat, lng, zoneSafetyService.GEOHASH_PRECISION);
  },

  getGeohashesForRoute: (routePoints: {lat: number, lng: number}[]) => {
    const hashes = new Set<string>();
    routePoints.forEach(point => {
      hashes.add(zoneSafetyService.getGeohashForLocation(point.lat, point.lng));
    });
    return Array.from(hashes);
  },

  submitReview: async (review: Omit<ZoneReview, 'id' | 'userId' | 'createdAt'>) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const reviewRef = doc(collection(db, 'zone_reviews'));
    const statsRef = doc(db, 'zone_stats', review.geohash);

    const newReview: ZoneReview = {
      ...review,
      userId: currentUser.uid,
      createdAt: serverTimestamp()
    };

    try {
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        
        let newAverage = review.rating;
        let newCount = 1;

        if (statsDoc.exists()) {
          const stats = statsDoc.data() as ZoneStats;
          const totalScore = stats.averageRating * stats.reviewCount;
          newCount = stats.reviewCount + 1;
          newAverage = (totalScore + review.rating) / newCount;
        }

        // Set the review
        transaction.set(reviewRef, newReview);
        
        // Set the aggregated stats
        transaction.set(statsRef, {
          geohash: review.geohash,
          averageRating: newAverage,
          reviewCount: newCount
        });
      });
      
      return reviewRef.id;
    } catch (error) {
      console.error('Error submitting review:', error);
      throw error;
    }
  },

  getZoneStats: async (hash: string): Promise<ZoneStats | null> => {
    try {
      const docRef = doc(db, 'zone_stats', hash);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as ZoneStats;
      }
      return null;
    } catch (error) {
      console.error('Error fetching zone stats:', error);
      return null;
    }
  },

  getMultipleZoneStats: async (hashes: string[]): Promise<Record<string, ZoneStats>> => {
    if (hashes.length === 0) return {};
    
    try {
      const result: Record<string, ZoneStats> = {};
      
      // Firestore 'in' query supports max 10 elements. We might need to chunk.
      const fetchChunk = async (chunk: string[]) => {
        const q = query(
          collection(db, 'zone_stats'),
          where('geohash', 'in', chunk)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          result[doc.id] = doc.data() as ZoneStats;
        });
      };

      for (let i = 0; i < hashes.length; i += 10) {
        await fetchChunk(hashes.slice(i, i + 10));
      }

      return result;
    } catch (error) {
      console.error('Error fetching multiple zone stats:', error);
      return {};
    }
  },

  getZoneReviews: async (hash: string): Promise<ZoneReview[]> => {
    try {
      const q = query(
        collection(db, 'zone_reviews'),
        where('geohash', '==', hash),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ZoneReview));
    } catch (error) {
      console.error('Error fetching zone reviews:', error);
      return [];
    }
  },

  submitCommunityRoute: async (route: Omit<CommunityRoute, 'id' | 'userId' | 'createdAt' | 'upvotes' | 'downvotes'>) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const routeRef = doc(collection(db, 'community_routes'));
    const newRoute: CommunityRoute = {
      ...route,
      userId: currentUser.uid,
      upvotes: 0,
      downvotes: 0,
      createdAt: serverTimestamp()
    };
    
    // Convert to native array type so Firestore doesn't complain about undefined properties in React state sometimes
    newRoute.reasons = newRoute.reasons || [];
    
    try {
      await runTransaction(db, async (transaction) => {
        transaction.set(routeRef, newRoute);
      });
      return routeRef.id;
    } catch (error) {
      console.error('Error submitting community route:', error);
      throw error;
    }
  },

  getCommunityRoutes: async (limitCount: number = 20): Promise<CommunityRoute[]> => {
    try {
      // Sorting by upvotes for now. We can also filter by location if we add geospatial queries
      const q = query(
        collection(db, 'community_routes'),
        orderBy('upvotes', 'desc')
        // We'd ideally limit here, but for MVP it's fine to fetch recent/top
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityRoute));
    } catch (error) {
      console.error('Error fetching community routes:', error);
      return [];
    }
  },
  
  voteOnRoute: async (routeId: string, voteValue: 1 | -1) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    
    const voteRef = doc(db, 'route_votes', `${currentUser.uid}_${routeId}`);
    const routeRef = doc(db, 'community_routes', routeId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const voteDoc = await transaction.get(voteRef);
        const routeDoc = await transaction.get(routeRef);
        
        if (!routeDoc.exists()) {
          throw new Error('Route does not exist!');
        }
        
        const currentRoute = routeDoc.data() as CommunityRoute;
        let upChange = 0;
        let downChange = 0;
        
        if (voteDoc.exists()) {
          // Already voted, maybe changing vote?
          const pastVote = voteDoc.data() as RouteVote;
          if (pastVote.vote === voteValue) {
            // Un-voting
            if (voteValue === 1) upChange = -1;
            else downChange = -1;
            
            transaction.delete(voteRef);
          } else {
            // Changing vote
            if (voteValue === 1) { upChange = 1; downChange = -1; }
            else { upChange = -1; downChange = 1; }
            
            transaction.update(voteRef, { vote: voteValue, timestamp: serverTimestamp() });
          }
        } else {
          // New vote
          if (voteValue === 1) upChange = 1;
          else downChange = 1;
          
          transaction.set(voteRef, {
            routeId,
            userId: currentUser.uid,
            vote: voteValue,
            timestamp: serverTimestamp()
          });
        }
        
        transaction.update(routeRef, {
          upvotes: currentRoute.upvotes + upChange,
          downvotes: currentRoute.downvotes + downChange
        });
      });
    } catch (error) {
      console.error('Error voting on route:', error);
      throw error;
    }
  }
};
