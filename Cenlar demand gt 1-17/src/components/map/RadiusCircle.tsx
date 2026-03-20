import { useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';

interface RadiusCircleProps {
  center: { lat: number; lng: number };
  radiusMiles: number;
  visible: boolean;
}

export function RadiusCircle({ center, radiusMiles, visible }: RadiusCircleProps) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!visible) {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map,
        center,
        radius: radiusMiles * 1609.34,
        fillColor: '#2563EB',
        fillOpacity: 0.15,
        strokeColor: '#2563EB',
        strokeWeight: 1,
        clickable: false,
      });
    } else {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(radiusMiles * 1609.34);
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, center, radiusMiles, visible]);

  return null;
}
