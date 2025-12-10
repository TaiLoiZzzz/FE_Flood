import { FLOOD_ZONES } from '../components/FloodMap';
import { FloodZone, FloodPoint } from '../types';

type LatLng = { lat: number; lng: number };
type RiskLevel = 'low' | 'medium' | 'high' | 'severe';

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';
const ORS_API_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ORS_API_KEY) ||
  (typeof process !== 'undefined' && (process as any).env?.VITE_ORS_API_KEY) ||
  'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjUzZjY3NTMyZDQ4ZjRmNTJiMDExZTc2MzkyNWQ1ZWUyIiwiaCI6Im11cm11cjY0In0=';

const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'severe'];

const closeRing = (coords: [number, number][]) => {
  if (coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
};

const shouldInclude = (risk: RiskLevel, minRisk: RiskLevel) =>
  riskOrder.indexOf(risk) >= riskOrder.indexOf(minRisk);

const zonesToMultiPolygon = (zones: FloodZone[], minRisk: RiskLevel) => {
  const polygons = zones
    .filter((z) => shouldInclude(z.default_risk, minRisk))
    .map((z) => {
      const ring: [number, number][] = z.polygon.map(([lat, lng]) => [lng, lat]);
      return [closeRing(ring)];
    });

  if (!polygons.length) return null;

  return {
    type: 'MultiPolygon',
    coordinates: polygons,
  } as const;
};

const pointsToPolygons = (points: FloodPoint[], radiusMeters = 200) => {
  const polygons: [number, number][][] = [];
  const segments = 12;
  points.forEach((p) => {
    const lat = p.lat;
    const lng = p.lng;
    const dLat = radiusMeters / 111000; // deg
    const dLng = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));
    const ring: [number, number][] = [];
    for (let i = 0; i < segments; i++) {
      const theta = (2 * Math.PI * i) / segments;
      const latOffset = Math.sin(theta) * dLat;
      const lngOffset = Math.cos(theta) * dLng;
      ring.push([lng + lngOffset, lat + latOffset]);
    }
    ring.push(ring[0]);
    polygons.push(ring);
  });
  return polygons;
};

const buildAvoidMultiPolygon = (params: {
  zones: FloodZone[];
  minRisk: RiskLevel;
  includeAllPoints?: boolean;
  points?: FloodPoint[];
}) => {
  const base = zonesToMultiPolygon(params.zones, params.minRisk);
  const pointPolygons =
    params.includeAllPoints && params.points && params.points.length
      ? pointsToPolygons(params.points)
      : [];

  const combined: [number, number][][] = [];
  if (base?.coordinates?.length) combined.push(...base.coordinates);
  if (pointPolygons.length) {
    pointPolygons.forEach((ring) => combined.push([ring]));
  }

  if (!combined.length) return null;
  return {
    type: 'MultiPolygon',
    coordinates: combined,
  } as const;
};

export interface ORSRouteResult {
  line: LatLng[];
  raw: any;
  distance?: number;
  duration?: number;
}

export interface GeoSuggestItem {
  label: string;
  lat: number;
  lng: number;
}

// Decode Google-style polyline (ORS default)
const decodePolyline = (str: string, precision = 5): [number, number][] => {
  let index = 0;
  const coordinates: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
};

export const geocodeSuggest = async (query: string): Promise<GeoSuggestItem[]> => {
  if (!query || query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'FloodWatch/1.0 (demo)',
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((item: any) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
};

export const getRouteORS = async (params: {
  from: LatLng;
  to: LatLng;
  minRisk?: RiskLevel;
  includeAllPoints?: boolean;
  points?: FloodPoint[];
}): Promise<ORSRouteResult> => {
  if (!ORS_API_KEY) throw new Error('Thiếu ORS API key (VITE_ORS_API_KEY).');

  const body: any = {
    coordinates: [
      [params.from.lng, params.from.lat],
      [params.to.lng, params.to.lat],
    ],
    format: 'geojson',
    instructions: false,
    options: {},
  };

  const avoid = buildAvoidMultiPolygon({
    zones: FLOOD_ZONES,
    minRisk: params.minRisk || 'high',
    includeAllPoints: params.includeAllPoints,
    points: params.points,
  });
  if (avoid) body.options.avoid_polygons = avoid;

  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: ORS_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ORS lỗi ${res.status}: ${txt.substring(0, 200)}`);
  }

  const data = await res.json();
  let coords: [number, number][] | undefined;
  let summary: any;

  // Case 1: GeoJSON response
  if (Array.isArray(data?.features) && data.features[0]?.geometry) {
    coords = data.features[0].geometry.coordinates as [number, number][];
    summary = data.features[0]?.properties?.summary;
  }

  // Case 2: JSON (default) with encoded polyline
  if (!coords && data?.routes?.[0]) {
    const route = data.routes[0];
    summary = route?.summary;
    if (typeof route.geometry === 'string') {
      coords = decodePolyline(route.geometry);
    } else if (route.geometry?.coordinates) {
      coords = route.geometry.coordinates as [number, number][];
    }
  }

  if (!coords || !coords.length) throw new Error('ORS không trả về tọa độ tuyến đường.');

  const line = coords.map(([lng, lat]) => ({ lat, lng }));

  return {
    line,
    raw: data,
    distance: summary?.distance,
    duration: summary?.duration,
  };
};

