import { useEffect, useRef } from 'react';
import maplibregl from 'https://esm.sh/maplibre-gl@5.23.0?bundle';
import { MapboxOverlay } from 'https://esm.sh/@deck.gl/mapbox@9.3.0?bundle';

export type ViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  transitionDuration?: number;
};

export type MapHandle = any; // maplibregl.Map-compatible handle (flyTo, easeTo, ...)

interface MaplibreMapProps {
  viewState: ViewState;
  mapStyle: any;
  interactive?: boolean;
  layers: any[];
  mapRef?: { current: MapHandle | null };
  onMove?: (evt: { viewState: ViewState }) => void;
}

export default function MaplibreMap({
  viewState,
  mapStyle,
  interactive = false,
  layers,
  mapRef,
  onMove,
}: MaplibreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const latestOnMoveRef = useRef(onMove);
  latestOnMoveRef.current = onMove;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new (maplibregl as any).Map({
      container: containerRef.current,
      style: mapStyle,
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch ?? 0,
      bearing: viewState.bearing ?? 0,
      interactive,
      attributionControl: false,
    });
    mapInstanceRef.current = map;
    if (mapRef) mapRef.current = map;

    const overlay = new (MapboxOverlay as any)({ layers, interleaved: false });
    map.addControl(overlay);
    overlayRef.current = overlay;

    const handleMove = () => {
      const center = map.getCenter();
      latestOnMoveRef.current?.({
        viewState: {
          longitude: center.lng,
          latitude: center.lat,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        },
      });
    };
    map.on('move', handleMove);

    const ro = new ResizeObserver(() => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      try { map.off('move', handleMove); } catch { /* ignore */ }
      try { map.remove(); } catch { /* ignore */ }
      mapInstanceRef.current = null;
      overlayRef.current = null;
      if (mapRef) mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const duration = Math.max(50, viewState.transitionDuration ?? 600);
    try {
      map.easeTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        pitch: viewState.pitch ?? 0,
        bearing: viewState.bearing ?? 0,
        duration,
      });
    } catch { /* ignore */ }
  }, [
    viewState.longitude,
    viewState.latitude,
    viewState.zoom,
    viewState.pitch,
    viewState.bearing,
    viewState.transitionDuration,
  ]);

  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
}
