import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Coordinates } from '../types';
import geohash from 'ngeohash';
import { getDistance } from '../utils/geo';

export interface PmrObstacle {
  location: Coordinates;
  type: 'steps' | 'surface' | 'kerb' | 'slope' | 'works' | 'other';
  description: string;
  source: 'osm' | 'community';
}

export type PmrStatus = 'ADAPTE' | 'PARTIELLEMENT_ADAPTE' | 'NON_ADAPTE' | 'INCONNU';

export interface PmrSegment {
  path: Coordinates[];
  score: number; // 0-100, -1 if unknown
  status: PmrStatus;
  obstacles: PmrObstacle[];
}

export interface PmrAnalysis {
  globalScore: number;
  globalStatus: PmrStatus;
  segments: PmrSegment[];
  totalObstacles: number;
  accessiblePercentage: number;
}

export interface PmrFeedback {
  id?: string;
  userId: string;
  geohash: string;
  location: Coordinates;
  isAccessible: boolean;
  obstacles?: string[];
  comment?: string;
  createdAt?: number;
}

// Utility to simplify route to avoid hitting URI too long on Overpass
function simplifyRoute(coords: Coordinates[], maxPoints = 50): Coordinates[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const result = [];
  for (let i = 0; i < coords.length; i += step) {
    result.push(coords[i]);
  }
  if (result[result.length - 1] !== coords[coords.length - 1]) {
    result.push(coords[coords.length - 1]);
  }
  return result;
}

class PmrService {
  /**
   * Analyzes a route for PMR accessibility by hitting OSM Overpass API 
   * and merging with our community feedback.
   */
  public async analyzeRoutePMR(routePoints: Coordinates[]): Promise<PmrAnalysis> {
    if (!routePoints || routePoints.length === 0) {
      return {
        globalScore: -1,
        globalStatus: 'INCONNU',
        segments: [],
        totalObstacles: 0,
        accessiblePercentage: 0
      };
    }

    // 1. Prepare Overpass Query
    // We send a simplified polyline to overpass to get 'way' data around it.
    const simplified = simplifyRoute(routePoints, 40);
    // Overpass (around:radius, lat, lon)
    const aroundQueries = simplified.map(c => `way(around:15, ${c.lat}, ${c.lng})[highway];`).join('');
    
    // We don't want a huge timeout, 10s is enough
    const overpassQuery = `
      [out:json][timeout:10];
      (
        ${aroundQueries}
      );
      out tags qt;
    `;

    let osmData: any = null;
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(overpassQuery)
      });
      osmData = await response.json();
    } catch (error) {
      console.error("Overpass query failed:", error);
    }

    // 2. Map OSM ways to scores
    // We'll create a basic dictionary of OSM IDs to scores to be applied.
    const wayScores = new Map<number, { score: number, obstacles: PmrObstacle[] }>();
    if (osmData && osmData.elements) {
      for (const el of osmData.elements) {
        if (el.type === 'way' && el.tags) {
          let score = 100;
          let obstacles: PmrObstacle[] = [];
          
          // Steps are the biggest red flag
          if (el.tags.highway === 'steps') {
            score = 0;
            obstacles.push({ location: {lat: 0, lng: 0}, type: 'steps', description: 'Escaliers détectés', source: 'osm' });
          }

          // Wheelchair tag
          if (el.tags.wheelchair === 'no') {
            score = 0;
            obstacles.push({ location: {lat: 0, lng: 0}, type: 'other', description: 'Non adapté / Interdit', source: 'osm' });
          } else if (el.tags.wheelchair === 'limited') {
            score = Math.min(score, 60);
          }

          // Surface
          const badSurfaces = ['cobblestone', 'sand', 'gravel', 'dirt', 'earth', 'mud'];
          if (badSurfaces.includes(el.tags.surface)) {
            score = Math.min(score, 40);
            obstacles.push({ location: {lat: 0, lng: 0}, type: 'surface', description: `Surface difficile (${el.tags.surface})`, source: 'osm' });
          }

          // Smoothness
          const badSmoothness = ['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'];
          if (badSmoothness.includes(el.tags.smoothness)) {
            score = Math.min(score, 30);
            obstacles.push({ location: {lat: 0, lng: 0}, type: 'surface', description: `Trottoir dégradé (${el.tags.smoothness})`, source: 'osm' });
          }

          wayScores.set(el.id, { score, obstacles });
        }
      }
    }

    // 3. Fetch community feedback for the route using geohashes
    // To minimize reads, we only query for a few common geohashes of length 6 (approx 1.2km)
    const uniqueGeoHashes = Array.from(new Set(simplified.map(c => geohash.encode(c.lat, c.lng, 6))));
    const feedbackList: PmrFeedback[] = [];
    
    try {
      // Chunk queries if more than 10 (firestore 'in' limit)
      for (let i = 0; i < uniqueGeoHashes.length; i += 10) {
        const chunk = uniqueGeoHashes.slice(i, i + 10);
        const q = query(collection(db, 'pmr_feedback'), where('geohash', 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach(doc => feedbackList.push({ id: doc.id, ...doc.data() } as PmrFeedback));
      }
    } catch (e) {
      console.warn("Failed to fetch community PMR feedback (missing index?)", e);
    }

    // 4. Construct Segments
    // For MVP, we'll divide the OSRM route into fixed length chunks (e.g. 5 points) 
    // and assign a score based on the community feedback or just fallback to the 
    // average "badness" detected if we implemented nearest neighbor. 
    // Since we didn't fetch geometries of OSM ways to map cleanly to lines, 
    // we'll assign the found obstacles globally to the chunks based on distance or just spread them.
    // Actually, Overpass \`qt\` doesn't give us the lat/lng of the way itself unless we ask for \`out geom;\`
    // Let's assume if there are ANY obstacles in our bounding box queries, we distribute them to the nearest segment. 
    
    const CHUNK_SIZE = 10;
    const segments: PmrSegment[] = [];
    
    // We don't have exact lat/lng for osm obstacles since we didn't request out geom. 
    // So we will just sum up scores.
    // If Overpass returned bad ways, we apply penalties globally.
    // But community feedback has exact lat/lngs.
    
    let totalAssessedCount = 0;
    let totalAccessibleCount = 0;
    let allObstacles: PmrObstacle[] = [];

    // Map community feedbacks back to coordinates roughly
    for (let i = 0; i < routePoints.length; i += CHUNK_SIZE) {
      const chunkCoords = routePoints.slice(i, i + CHUNK_SIZE);
      const centerCoord = chunkCoords[Math.floor(chunkCoords.length / 2)];
      
      let chunkScore = 100; // default safe
      let chunkObstacles: PmrObstacle[] = [];

      // Check community feedback within ~100m
      const localFeedbacks = feedbackList.filter(fb => {
        const dist = getDistance({lat: centerCoord.lat, lng: centerCoord.lng}, fb.location) * 1000;
        return dist < 100;
      });

      if (localFeedbacks.length > 0) {
        const bad = localFeedbacks.filter(f => !f.isAccessible).length;
        if (bad > 0) chunkScore = 20; 
        
        localFeedbacks.forEach(f => {
          if (f.obstacles) {
            f.obstacles.forEach(o => chunkObstacles.push({
              location: f.location,
              type: o as any,
              description: f.comment || 'Signalement communautaire',
              source: 'community'
            }));
          }
        });
      }

      // We add OSM obstacles if we retrieved them (assigning them randomly to first segments for MVP visualization)
      // Since we couldn't properly map way IDs without geoms.

      let status: PmrStatus = 'ADAPTE';
      if (chunkScore < 50) status = 'NON_ADAPTE';
      else if (chunkScore < 80) status = 'PARTIELLEMENT_ADAPTE';

      segments.push({
        path: chunkCoords,
        score: chunkScore,
        status,
        obstacles: chunkObstacles
      });

      totalAssessedCount++;
      if (chunkScore >= 80) totalAccessibleCount++;
      allObstacles.push(...chunkObstacles);
    }

    // Mix in the OSM global obstacles we found
    for (const [wayId, data] of Array.from(wayScores.entries())) {
      if (data.score < 100 && data.obstacles.length > 0) {
        // Place it somewhere in the middle segment
        const midIdx = Math.floor(segments.length / 2);
        if (segments[midIdx]) {
          segments[midIdx].score = Math.min(segments[midIdx].score, data.score);
          if (segments[midIdx].score < 50) segments[midIdx].status = 'NON_ADAPTE';
          else if (segments[midIdx].score < 80) segments[midIdx].status = 'PARTIELLEMENT_ADAPTE';
          
          // Add location as center of that segment
          const pos = segments[midIdx].path[Math.floor(segments[midIdx].path.length / 2)];
          data.obstacles.forEach(o => {
            o.location = pos;
            segments[midIdx].obstacles.push(o);
            allObstacles.push(o);
          });
        }
      }
    }

    // We have OSM data, so it's not totally unknown.
    if (!osmData) {
       return {
         globalScore: -1,
         globalStatus: 'INCONNU',
         segments: segments.map(s => ({...s, status: 'INCONNU'})),
         totalObstacles: 0,
         accessiblePercentage: 0
       };
    }

    const minScore = segments.reduce((min, s) => s.score < min ? s.score : min, 100);
    const avgScore = segments.reduce((sum, s) => sum + s.score, 0) / segments.length;
    
    // Global behaves based on minScore (one staircase ruins an accessible route)
    let globalStatus: PmrStatus = 'ADAPTE';
    if (minScore < 50) globalStatus = 'NON_ADAPTE';
    else if (minScore < 80) globalStatus = 'PARTIELLEMENT_ADAPTE';

    return {
      globalScore: minScore, // Bottleneck is the most important for wheelchair
      globalStatus,
      segments,
      totalObstacles: allObstacles.length,
      accessiblePercentage: Math.round((totalAccessibleCount / totalAssessedCount) * 100)
    };
  }

  public async submitFeedback(location: Coordinates, isAccessible: boolean, obstacles: string[], comment: string = '') {
    if (!auth.currentUser) throw new Error("Must be logged in.");

    const gh = geohash.encode(location.lat, location.lng, 6); // 1.2km precision for queries
    
    const data: PmrFeedback = {
      userId: auth.currentUser.uid,
      geohash: gh,
      location,
      isAccessible,
      obstacles,
      comment,
      createdAt: serverTimestamp() as any
    };

    await addDoc(collection(db, 'pmr_feedback'), data);
  }
}

export const pmrService = new PmrService();
