import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Polyline } from 'react-native-maps';

import { colors } from '@/theme/tokens';
import type { RoutePoint } from '@/lib/health';

interface RunMapProps {
  points: ReadonlyArray<RoutePoint>;
  height?: number;
}

// Quiet map view — Apple Maps (PROVIDER_DEFAULT) to dodge Google Maps keys
// + their loud styling. Auto-fits the camera to the route bounds with a
// generous padding so the polyline reads as a hero element.
export function RunMap({ points, height = 220 }: RunMapProps) {
  const mapRef = useRef<MapView>(null);

  const initialRegion = useMemo(() => {
    if (points.length === 0) return undefined;
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const padFactor = 1.4;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.005, (maxLat - minLat) * padFactor),
      longitudeDelta: Math.max(0.005, (maxLng - minLng) * padFactor),
    };
  }, [points]);

  if (points.length < 2 || !initialRegion) return null;

  const polyline = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));

  return (
    <View style={{ height, borderRadius: 18, overflow: 'hidden' }} className="border border-hairline">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        // Quiet defaults — no user location dot, no compass, no scale,
        // no points of interest. The polyline is the only signal.
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onMapReady={() => {
          mapRef.current?.fitToCoordinates(polyline, {
            edgePadding: { top: 32, bottom: 32, left: 32, right: 32 },
            animated: false,
          });
        }}
      >
        <Polyline
          coordinates={polyline}
          strokeWidth={4}
          strokeColor={colors.moss}
          lineCap="round"
          lineJoin="round"
        />
      </MapView>
    </View>
  );
}
