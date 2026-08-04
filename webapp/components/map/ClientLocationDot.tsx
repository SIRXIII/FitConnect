import { AdvancedMarker } from '@vis.gl/react-google-maps';

interface ClientLocationDotProps {
  position: { lat: number; lng: number };
}

export function ClientLocationDot({ position }: ClientLocationDotProps) {
  return (
    <AdvancedMarker position={position} zIndex={50}>
      <div
        style={{
          position: 'relative',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer pulsing ring */}
        <div
          className="animate-ping"
          style={{
            position: 'absolute',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(37, 99, 235, 0.2)',
          }}
        />
        {/* Inner solid dot */}
        <div
          style={{
            position: 'relative',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#2563EB',
            border: '2px solid white',
            boxShadow: '0 0 0 1px rgba(37, 99, 235, 0.3)',
          }}
        />
      </div>
    </AdvancedMarker>
  );
}
