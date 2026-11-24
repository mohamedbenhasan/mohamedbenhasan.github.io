import React, { useEffect, useRef, useState } from 'react';
import { Marker, MarkerProps } from 'react-leaflet';
import L from 'leaflet';

interface SmoothMarkerProps extends Omit<MarkerProps, 'position'> {
  position: [number, number];
}

export const SmoothMarker: React.FC<SmoothMarkerProps> = ({ position, ...props }) => {
  const markerRef = useRef<L.Marker>(null);
  const targetPos = useRef<[number, number]>(position);
  const reqRef = useRef<number>();
  
  // Keep the initial position stable so react-leaflet doesn't fight our animation
  const [initialPos] = useState<[number, number]>(position);

  // Update target position whenever props change
  useEffect(() => {
    targetPos.current = position;
  }, [position[0], position[1]]);

  useEffect(() => {
    let lastTime = performance.now();
    
    const animate = (time: number) => {
      const leafletMarker = markerRef.current;
      if (leafletMarker) {
        const current = leafletMarker.getLatLng();
        const target = targetPos.current;
        
        const latDiff = target[0] - current.lat;
        const lngDiff = target[1] - current.lng;
        const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        
        if (dist > 0.01) {
          // If jump is too large (e.g. > 1km), don't animate, just snap
          leafletMarker.setLatLng(target);
        } else if (dist > 0.000001) {
          // Frame-rate independent exponential smoothing
          const delta = (time - lastTime) / 1000; // in seconds
          
          // Speed factor of 8 means it covers ~98% of distance in 0.5s
          // This perfectly smooths an 0.5s update interval
          const easing = 1 - Math.exp(-delta * 8); 
          
          leafletMarker.setLatLng([
            current.lat + latDiff * easing,
            current.lng + lngDiff * easing
          ]);
        }
      }
      
      lastTime = time;
      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, []); // Only run the loop setup once

  return <Marker ref={markerRef} position={initialPos} {...props} />;
};
