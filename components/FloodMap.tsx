// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { FloodPoint, FloodZone } from '../types';
import { MapPin, Droplets, Clock, Layers, Info, Wind, Waves, ArrowUpRight, Compass, LocateFixed, Globe } from 'lucide-react';

// --- DATA: HCMC BOUNDARY ---
const HCMC_BOUNDARY_COORDS: [number, number][] = [
    [11.160, 106.460], 
    [11.100, 106.550], 
    [11.000, 106.650], 
    [10.950, 106.750], 
    [10.920, 106.820], 
    [10.880, 106.850],
    [10.800, 106.820], 
    [10.700, 106.780], 
    [10.600, 106.850], 
    [10.500, 106.950], 
    [10.350, 106.900], 
    [10.450, 106.800], 
    [10.550, 106.750], 
    [10.650, 106.700], 
    [10.700, 106.600], 
    [10.750, 106.500],
    [10.850, 106.450],
    [10.950, 106.400], 
    [11.050, 106.420], 
    [11.160, 106.460]  
];

const WORLD_MASK: [number, number][] = [
    [90, -180], [90, 180], [-90, 180], [-90, -180]
];

const MASK_DATA: [number, number][][] = [WORLD_MASK, HCMC_BOUNDARY_COORDS];

// --- DATA: HIGH FIDELITY FLOOD ZONES ---
export const FLOOD_ZONES: FloodZone[] = [
  // ========================================
  // NHÓM 1: KHU VỰC VEN SÔNG (Dữ liệu nền Python Backend)
  // ========================================
  {
    id: "zone-q4-tran-xuan-soan",
    name: "Đường Trần Xuân Soạn",
    district: "Quận 4", // Backend ghi Q4, dù địa lý giáp Q7
    center: [10.7592, 106.7030],
    // Địa hình: Chạy dọc Kênh Tẻ. Polygon uốn lượn theo mép bờ kè.
    polygon: [
      [10.7565, 106.7012], [10.7572, 106.7008], [10.7580, 106.7015],
      [10.7588, 106.7022], [10.7592, 106.7030], // Đi qua Center
      [10.7600, 106.7042], [10.7610, 106.7055], [10.7622, 106.7065],
      [10.7628, 106.7060], [10.7620, 106.7050], [10.7612, 106.7040],
      [10.7605, 106.7030], [10.7598, 106.7025], [10.7585, 106.7020],
      [10.7575, 106.7018], [10.7565, 106.7012]
    ],
    properties: { elevation: "low", near_river: true, drainage: "poor" },
    simulation: { base_level: 0.15, tidal_sensitivity: 0.9, rain_sensitivity: 0.8, drain_rate: 0.3 },
    default_risk: "severe"
  },
  {
    id: "zone-q7-huynh-tan-phat",
    name: "Đường Huỳnh Tấn Phát",
    district: "Quận 7",
    center: [10.7355, 106.7205],
    // Địa hình: Đường thẳng dài nhưng trũng ở giữa, mép răng cưa do nước tràn vào hẻm.
    polygon: [
      [10.7320, 106.7175], [10.7328, 106.7185], [10.7335, 106.7192],
      [10.7345, 106.7200], [10.7355, 106.7205], // Đi qua Center
      [10.7365, 106.7215], [10.7380, 106.7235], [10.7395, 106.7245],
      [10.7405, 106.7235], [10.7390, 106.7225], [10.7375, 106.7210],
      [10.7360, 106.7198], [10.7348, 106.7190], [10.7332, 106.7180],
      [10.7320, 106.7175]
    ],
    properties: { elevation: "low", near_river: true, drainage: "poor" },
    simulation: { base_level: 0.12, tidal_sensitivity: 0.85, rain_sensitivity: 0.75, drain_rate: 0.35 },
    default_risk: "severe"
  },
  {
    id: "zone-q8-au-duong-lan",
    name: "Đường Âu Dương Lân",
    district: "Quận 8",
    center: [10.7415, 106.6575],
    // Địa hình: Bàn cờ hẻm dày đặc, shape lồi lõm không đều.
    polygon: [
      [10.7380, 106.6545], [10.7390, 106.6555], [10.7400, 106.6565],
      [10.7410, 106.6570], [10.7415, 106.6575], // Center
      [10.7425, 106.6585], [10.7435, 106.6600], [10.7450, 106.6615],
      [10.7455, 106.6605], [10.7445, 106.6590], [10.7432, 106.6575],
      [10.7420, 106.6560], [10.7405, 106.6550], [10.7392, 106.6535],
      [10.7380, 106.6545]
    ],
    properties: { elevation: "low", near_river: false, drainage: "poor" },
    simulation: { base_level: 0.10, tidal_sensitivity: 0.5, rain_sensitivity: 0.8, drain_rate: 0.35 },
    default_risk: "high"
  },
  {
    id: "zone-nhabe-nguyen-binh",
    name: "Đường Nguyễn Bình",
    district: "Nhà Bè",
    center: [10.6890, 106.7355],
    // Địa hình: Ven rạch dừa nước, shape hình sin (sóng) mềm mại.
    polygon: [
      [10.6850, 106.7315], [10.6865, 106.7328], [10.6880, 106.7340],
      [10.6890, 106.7355], // Center
      [10.6905, 106.7375], [10.6920, 106.7395], [10.6935, 106.7380],
      [10.6925, 106.7365], [10.6912, 106.7350], [10.6900, 106.7335],
      [10.6885, 106.7325], [10.6870, 106.7312], [10.6850, 106.7315]
    ],
    properties: { elevation: "low", near_river: true, drainage: "poor" },
    simulation: { base_level: 0.18, tidal_sensitivity: 0.85, rain_sensitivity: 0.75, drain_rate: 0.25 },
    default_risk: "severe"
  },

  // ========================================
  // NHÓM 2: VÙNG TRŨNG (Risk: High)
  // ========================================
  {
    id: "zone-binhchanh-quoc-lo-50",
    name: "Quốc lộ 50",
    district: "Bình Chánh",
    center: [10.7015, 106.6190],
    // Địa hình: Vệt dài loang lổ dọc trục lộ xuyên đồng ruộng.
    polygon: [
      [10.6980, 106.6150], [10.6990, 106.6162], [10.7000, 106.6175],
      [10.7015, 106.6190], // Center
      [10.7030, 106.6210], [10.7045, 106.6235], [10.7055, 106.6225],
      [10.7042, 106.6205], [10.7030, 106.6195], [10.7018, 106.6180],
      [10.7005, 106.6165], [10.6992, 106.6152], [10.6980, 106.6150]
    ],
    properties: { elevation: "low", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.12, tidal_sensitivity: 0.4, rain_sensitivity: 0.85, drain_rate: 0.4 },
    default_risk: "high"
  },
  {
    id: "zone-binhchanh-an-suong",
    name: "Ngã tư An Sương",
    district: "Bình Chánh", // Theo backend label
    center: [10.8650, 106.6165],
    // Địa hình: Hình cỏ 4 lá (Cloverleaf) tại nút giao.
    polygon: [
      [10.8620, 106.6150], [10.8635, 106.6155], [10.8645, 106.6160],
      [10.8650, 106.6165], // Center
      [10.8665, 106.6190], [10.8680, 106.6175], [10.8672, 106.6165],
      [10.8660, 106.6155], [10.8648, 106.6145], [10.8630, 106.6140],
      [10.8620, 106.6150]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.09, tidal_sensitivity: 0.3, rain_sensitivity: 0.75, drain_rate: 0.45 },
    default_risk: "high"
  },
  {
    id: "zone-q8-pham-hung",
    name: "Đường Phạm Hùng",
    district: "Quận 8",
    center: [10.7258, 106.6812],
    // Địa hình: Hình giọt nước, tụ nước ngay giao lộ/dốc cầu.
    polygon: [
      [10.7220, 106.6780], [10.7235, 106.6795], [10.7245, 106.6805],
      [10.7258, 106.6812], // Center
      [10.7275, 106.6835], [10.7295, 106.6845], [10.7285, 106.6830],
      [10.7272, 106.6815], [10.7260, 106.6800], [10.7240, 106.6788],
      [10.7220, 106.6780]
    ],
    properties: { elevation: "low", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.10, tidal_sensitivity: 0.5, rain_sensitivity: 0.85, drain_rate: 0.4 },
    default_risk: "high"
  },

  // ========================================
  // NHÓM 3: NỘI ĐÔ (Risk: Medium)
  // ========================================
  {
    id: "zone-q1-calmette",
    name: "Đường Calmette",
    district: "Quận 1",
    center: [10.7720, 106.6995],
    // Địa hình: Khối chữ nhật vát góc (khu phố bàn cờ).
    polygon: [
      [10.7695, 106.6980], [10.7705, 106.6990], [10.7715, 106.6995],
      [10.7720, 106.6995], // Center boundary check
      [10.7735, 106.7015], [10.7745, 106.7010], [10.7740, 106.7000],
      [10.7730, 106.6992], [10.7720, 106.6985], [10.7710, 106.6978],
      [10.7695, 106.6980]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.05, tidal_sensitivity: 0.3, rain_sensitivity: 0.7, drain_rate: 0.6 },
    default_risk: "medium"
  },
  {
    id: "zone-q1-nguyen-thai-binh",
    name: "Đường Nguyễn Thái Bình",
    district: "Quận 1",
    center: [10.7740, 106.6960],
    // Địa hình: Hình thoi xiên (khu tài chính).
    polygon: [
      [10.7720, 106.6950], [10.7730, 106.6955], [10.7740, 106.6960], // Center
      [10.7750, 106.6975], [10.7760, 106.6968], [10.7752, 106.6960],
      [10.7742, 106.6950], [10.7732, 106.6942], [10.7720, 106.6950]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.06, tidal_sensitivity: 0.3, rain_sensitivity: 0.65, drain_rate: 0.55 },
    default_risk: "medium"
  },
  {
    id: "zone-q1-co-giang",
    name: "Đường Cô Giang",
    district: "Quận 1",
    center: [10.7685, 106.6940],
    // Địa hình: Dải dài song song Rạch Bến Nghé.
    polygon: [
      [10.7660, 106.6920], [10.7675, 106.6932], [10.7685, 106.6940], // Center
      [10.7702, 106.6960], [10.7712, 106.6952], [10.7700, 106.6940],
      [10.7688, 106.6928], [10.7675, 106.6918], [10.7660, 106.6920]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.06, tidal_sensitivity: 0.35, rain_sensitivity: 0.7, drain_rate: 0.55 },
    default_risk: "medium"
  },
  {
    id: "zone-binhthanh-xo-viet-nghe-tinh",
    name: "Xô Viết Nghệ Tĩnh",
    district: "Bình Thạnh",
    center: [10.8058, 106.7075],
    // Địa hình: Hình phễu (nước đổ về ngã 5 Đài Liệt Sĩ).
    polygon: [
      [10.8020, 106.7050], [10.8035, 106.7060], [10.8048, 106.7070],
      [10.8058, 106.7075], // Center
      [10.8075, 106.7095], [10.8090, 106.7110], [10.8098, 106.7098],
      [10.8085, 106.7082], [10.8070, 106.7070], [10.8055, 106.7055],
      [10.8040, 106.7045], [10.8020, 106.7050]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.08, tidal_sensitivity: 0.4, rain_sensitivity: 0.8, drain_rate: 0.5 },
    default_risk: "high"
  },

  // ========================================
  // NHÓM 4: KHU VỰC THỦ ĐỨC & KHÁC
  // ========================================
  {
    id: "zone-thuduc-do-xuan-hop",
    name: "Đường Đỗ Xuân Hợp",
    district: "Thủ Đức", // Backend key
    center: [10.8220, 106.7692],
    // Địa hình: Zigzac men theo đường cống đang thi công rạch.
    polygon: [
      [10.8180, 106.7650], [10.8195, 106.7665], [10.8210, 106.7680],
      [10.8220, 106.7692], // Center
      [10.8245, 106.7725], [10.8262, 106.7735], [10.8252, 106.7720],
      [10.8240, 106.7705], [10.8230, 106.7690], [10.8215, 106.7675],
      [10.8200, 106.7660], [10.8180, 106.7650]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.08, tidal_sensitivity: 0.3, rain_sensitivity: 0.75, drain_rate: 0.5 },
    default_risk: "high"
  },
  {
    id: "zone-thuduc-nguyen-duy-trinh",
    name: "Đường Nguyễn Duy Trinh",
    district: "Thủ Đức",
    center: [10.7918, 106.7855],
    // Địa hình: Dải rất hẹp và dài (đường container chạy).
    polygon: [
      [10.7880, 106.7820], [10.7895, 106.7835], [10.7910, 106.7850],
      [10.7918, 106.7855], // Center
      [10.7940, 106.7885], [10.7960, 106.7895], [10.7950, 106.7880],
      [10.7935, 106.7865], [10.7920, 106.7850], [10.7905, 106.7835],
      [10.7880, 106.7820]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.07, tidal_sensitivity: 0.25, rain_sensitivity: 0.7, drain_rate: 0.55 },
    default_risk: "medium"
  },
  {
    id: "zone-govap-pham-van-dong",
    name: "Đường Phạm Văn Đồng",
    district: "Gò Vấp",
    center: [10.8420, 106.6855],
    // Địa hình: Dải hình thang, bám vào 1 bên làn xe máy (do đường nghiêng).
    polygon: [
      [10.8380, 106.6820], [10.8395, 106.6835], [10.8410, 106.6850],
      [10.8420, 106.6855], // Center
      [10.8435, 106.6875], [10.8460, 106.6895], [10.8450, 106.6885],
      [10.8435, 106.6865], [10.8420, 106.6845], [10.8400, 106.6825],
      [10.8380, 106.6820]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.06, tidal_sensitivity: 0.2, rain_sensitivity: 0.7, drain_rate: 0.6 },
    default_risk: "medium"
  },
  {
    id: "zone-tanbinh-truong-chinh",
    name: "Đường Trường Chinh",
    district: "Tân Bình",
    center: [10.8158, 106.6455],
    // Địa hình: Hình mũi tàu/Tam giác (do giao lộ lớn).
    polygon: [
      [10.8120, 106.6420], [10.8135, 106.6435], [10.8150, 106.6450],
      [10.8158, 106.6455], // Center
      [10.8175, 106.6480], [10.8190, 106.6495], [10.8182, 106.6482],
      [10.8170, 106.6465], [10.8160, 106.6450], [10.8145, 106.6435],
      [10.8130, 106.6425], [10.8120, 106.6420]
    ],
    properties: { elevation: "medium", near_river: false, drainage: "moderate" },
    simulation: { base_level: 0.07, tidal_sensitivity: 0.25, rain_sensitivity: 0.7, drain_rate: 0.55 },
    default_risk: "medium"
  }
];

// --- CONSTANTS ---
const CENTER_LAT = 10.762622;
const CENTER_LNG = 106.660172;
const BOUNDS_SW = L.latLng(10.3, 106.3);
const BOUNDS_NE = L.latLng(11.2, 107.1);
const MAX_BOUNDS = L.latLngBounds(BOUNDS_SW, BOUNDS_NE);

// --- HELPER FUNCTIONS ---
const getRiskColor = (risk: string) => {
    switch (risk) {
        case 'severe': return { fill: '#e11d48', stroke: '#be123c' }; // Rose-600/700
        case 'high': return { fill: '#f97316', stroke: '#c2410c' }; // Orange-500/700
        case 'medium': return { fill: '#f59e0b', stroke: '#b45309' }; // Amber-500/700
        default: return { fill: '#3b82f6', stroke: '#1d4ed8' }; // Blue-500/700
    }
};

const getRiskScore = (severity: string) => {
  switch (severity) {
    case 'severe': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    default: return 1;
  }
};

const getSeverityFromScore = (score: number) => {
  if (score >= 4) return 'severe';
  if (score === 3) return 'high';
  if (score === 2) return 'medium';
  return 'low';
};

const createCustomIcon = (severity: string, depth: number) => {
  let color = '#3b82f6'; 
  let rgb = '59, 130, 246';

  if (severity === 'medium') { color = '#f59e0b'; rgb = '245, 158, 11'; }
  if (severity === 'high') { color = '#f97316'; rgb = '249, 115, 22'; }
  if (severity === 'severe') { color = '#e11d48'; rgb = '225, 29, 72'; }

  const size = Math.min(Math.max(28, depth / 1.5), 56); 

  return L.divIcon({
    className: 'custom-marker-pin',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; --color-ring: ${rgb};">
        <div class="animate-ripple" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(${rgb}, 0.6);"></div>
        <div class="animate-ripple" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(${rgb}, 0.4); animation-delay: 1s;"></div>
        <div style="width: ${size * 0.4}px; height: ${size * 0.4}px; background: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(${rgb}, 0.6); z-index: 2; position: relative;"></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

const createClusterIcon = (count: number, maxSeverity: string) => {
    let color = '#3b82f6'; // Blue
    let rgb = '59, 130, 246';

    if (maxSeverity === 'severe') { color = '#e11d48'; rgb = '225, 29, 72'; }
    else if (maxSeverity === 'high') { color = '#f97316'; rgb = '249, 115, 22'; }
    else if (maxSeverity === 'medium') { color = '#f59e0b'; rgb = '245, 158, 11'; }

    const size = 40 + (count.toString().length * 5); // Dynamic size

    return L.divIcon({
        className: 'cluster-icon',
        html: `
            <div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; position: relative; --cluster-color: ${color};">
                <div style="position: absolute; inset: 0; background: ${color}; opacity: 0.2; border-radius: 50%;"></div>
                <div style="width: ${size - 8}px; height: ${size - 8}px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid white; z-index: 10;">
                    <span style="color: white; font-weight: 800; font-size: 14px;">${count}</span>
                </div>
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

const MapController = () => {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(MAX_BOUNDS);
    map.setMinZoom(10); 
  }, [map]);
  return null;
};

// Component to handle flying to location
const FlyToLocation = ({ coords, track }: { coords: { lat: number; lng: number } | null, track: boolean }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && track) {
            map.flyTo([coords.lat, coords.lng], 15, { duration: 1.5, animate: true });
        }
    }, [coords, map, track]);
    return null;
}

// --- CLUSTER MANAGER COMPONENT ---
// Handles calculating clusters and rendering markers based on zoom level
const FloodMarkers = ({ points }: { points: FloodPoint[] }) => {
    const map = useMap();
    const [clusters, setClusters] = useState<any[]>([]);
    const [bounds, setBounds] = useState<any>(null);
    const [zoom, setZoom] = useState(12);

    // Initialize Supercluster
    // We use a reducer to track the maximum severity within a cluster
    const superclusterRef = useRef(new Supercluster({
        radius: 60,
        maxZoom: 16,
        map: (props) => ({ severityScore: getRiskScore(props.severity) }),
        reduce: (accumulated, props) => {
            accumulated.severityScore = Math.max(accumulated.severityScore, props.severityScore);
        }
    }));

    // Update Supercluster data when points change
    useEffect(() => {
        const geoJsonPoints = points.map(point => ({
            type: 'Feature' as const,
            properties: { 
                cluster: false, 
                pointId: point.id, 
                ...point 
            },
            geometry: {
                type: 'Point' as const,
                coordinates: [point.lng, point.lat]
            }
        }));

        superclusterRef.current.load(geoJsonPoints as any);
        updateClusters();
    }, [points]);

    // Update clusters function
    const updateClusters = useCallback(() => {
        if (!map) return;
        
        const b = map.getBounds();
        const z = map.getZoom();
        
        // Convert Leaflet bounds to [west, south, east, north]
        const bbox: [number, number, number, number] = [
            b.getWest(), b.getSouth(), b.getEast(), b.getNorth()
        ];
        
        setZoom(z);
        setBounds(bbox);
        
        try {
            const newClusters = superclusterRef.current.getClusters(bbox, z);
            setClusters(newClusters);
        } catch (e) {
            console.error("Clustering error", e);
        }
    }, [map]);

    // Listen to map events
    useMapEvents({
        moveend: updateClusters,
        zoomend: updateClusters
    });

    // Initial load
    useEffect(() => {
        updateClusters();
    }, [map, updateClusters]);

    return (
        <>
            {clusters.map((cluster) => {
                const [longitude, latitude] = cluster.geometry.coordinates;
                const { cluster: isCluster, point_count: pointCount, severityScore } = cluster.properties;

                // --- RENDER CLUSTER ---
                if (isCluster) {
                    const maxSeverity = getSeverityFromScore(severityScore);
                    
                    return (
                        <Marker
                            key={`cluster-${cluster.id}`}
                            position={[latitude, longitude]}
                            icon={createClusterIcon(pointCount, maxSeverity)}
                            eventHandlers={{
                                click: () => {
                                    const expansionZoom = Math.min(
                                        superclusterRef.current.getClusterExpansionZoom(cluster.id),
                                        17
                                    );
                                    map.setView([latitude, longitude], expansionZoom, { animate: true });
                                }
                            }}
                        />
                    );
                }

                // --- RENDER INDIVIDUAL POINT ---
                const point = cluster.properties; // Contains the original point data spread
                return (
                    <Marker 
                        key={`point-${point.pointId || point.lat}-${point.lng}`} 
                        position={[latitude, longitude]}
                        icon={createCustomIcon(point.severity, point.depth)}
                    >
                        <Popup>
                            <div className="bg-white font-sans w-[280px]">
                                <div className="bg-slate-900 p-4 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <MapPin size={64} />
                                    </div>
                                    <div className="relative z-10">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 inline-block ${
                                            point.severity === 'severe' ? 'bg-red-500' : point.severity === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                                        }`}>
                                            {point.severity === 'severe' ? 'Nghiêm trọng' : point.severity === 'high' ? 'Cảnh báo cao' : 'Ngập nhẹ'}
                                        </span>
                                        <h3 className="font-bold text-base leading-tight pr-4">
                                            {point.locationName}
                                        </h3>
                                    </div>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mực nước</span>
                                            <div className="flex items-end gap-1 text-blue-600">
                                                <span className="text-3xl font-bold leading-none">{point.depth}</span>
                                                <span className="text-sm font-medium mb-1">cm</span>
                                            </div>
                                        </div>
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                                            <Droplets size={24} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-100 pt-3">
                                        <Clock className="w-3 h-3" />
                                        <span>Cập nhật: {new Date(point.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
};

interface FloodMapProps {
  points: FloodPoint[];
  routeCoords?: { lat: number; lng: number }[];
  routeEndpoints?: { from?: { lat: number; lng: number }, to?: { lat: number; lng: number } };
}

export const FloodMap: React.FC<FloodMapProps> = ({ points, routeCoords, routeEndpoints }) => {
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'dark'>('dark');
  const [tracking, setTracking] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition(
           (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
           (err) => console.error("Location error", err)
       );
    }
    return () => {
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const toggleTracking = () => {
      if (tracking) {
          setTracking(false);
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
      } else {
          setTracking(true);
          if (navigator.geolocation) {
              watchId.current = navigator.geolocation.watchPosition(
                  (pos) => {
                      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  },
                  (err) => {
                      console.error("Tracking error", err);
                      setTracking(false);
                  },
                  { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
              );
          }
      }
  }

  const getTileUrl = () => {
      switch(mapType) {
          case 'satellite': return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
          case 'dark': return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
          default: return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      }
  }

  return (
    <div className="h-full w-full bg-slate-900 relative isolate">
      <MapContainer
        center={[CENTER_LAT, CENTER_LNG]}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full outline-none z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url={getTileUrl()}
        />
        <MapController />
        <FlyToLocation coords={userLocation} track={tracking} />
        
        {/* === HCMC VISUALIZATION LAYER (VIP MODE) === */}
        {showBoundary && (
            <>
                {/* 1. MASK: Dims everything OUTSIDE HCMC */}
                <Polygon 
                    positions={MASK_DATA}
                    pathOptions={{ 
                        color: 'transparent',
                        fillColor: '#0f172a', // Slate-900
                        fillOpacity: 0.75,
                        stroke: false
                    }}
                />
                
                {/* 2. NEON BORDER: The glowing outline of the city */}
                <Polyline 
                    positions={HCMC_BOUNDARY_COORDS}
                    pathOptions={{
                        color: '#06b6d4', // Cyan-500
                        weight: 3,
                        opacity: 0.8,
                        dashArray: '10, 5',
                        lineCap: 'round',
                        lineJoin: 'round',
                        className: 'animate-pulse-slow' // Custom class for glow effect if added to CSS
                    }}
                />
                 {/* 3. Outer Glow (Simulated with thicker line) */}
                 <Polyline 
                    positions={HCMC_BOUNDARY_COORDS}
                    pathOptions={{
                        color: '#22d3ee', // Cyan-400
                        weight: 8,
                        opacity: 0.2,
                        lineCap: 'round',
                        lineJoin: 'round',
                    }}
                />
            </>
        )}

        {/* User Location Marker */}
        {userLocation && (
             <>
                <Circle 
                    center={[userLocation.lat, userLocation.lng]} 
                    pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, stroke: false }} 
                    radius={100} 
                />
                <Marker position={[userLocation.lat, userLocation.lng]} icon={L.divIcon({
                    className: 'user-pin',
                    html: `
                        <div class="relative w-4 h-4">
                            <div class="absolute inset-0 bg-blue-500 rounded-full opacity-30 animate-ping"></div>
                            <div class="absolute inset-0.5 bg-white rounded-full shadow-md border-2 border-blue-600"></div>
                        </div>
                    `,
                    iconSize: [16, 16]
                })}>
                    <Popup>
                        <div className="text-xs font-bold font-sans">Vị trí của bạn</div>
                    </Popup>
                </Marker>
             </>
        )}

        {/* Flood Polygons (Zones) */}
        {FLOOD_ZONES.map((zone) => {
            const colors = getRiskColor(zone.default_risk);
            return (
                <Polygon
                    key={zone.id}
                    positions={zone.polygon}
                    pathOptions={{
                        color: colors.stroke,
                        fillColor: colors.fill,
                        fillOpacity: 0.25, 
                        weight: 2,
                        dashArray: '5, 10',
                        lineCap: 'round',
                        lineJoin: 'round',
                        className: `outline-none transition-all duration-300 ${zone.default_risk === 'severe' ? 'animate-pulse-slow' : ''}`
                    }}
                    eventHandlers={{
                        mouseover: (e) => {
                            const layer = e.target;
                            layer.setStyle({
                                weight: 4,
                                fillOpacity: 0.6,
                                dashArray: '',
                            });
                            layer.bringToFront();
                        },
                        mouseout: (e) => {
                            const layer = e.target;
                            layer.setStyle({
                                weight: 2,
                                fillOpacity: 0.25,
                                dashArray: '5, 10',
                            });
                        }
                    }}
                >
                    <Popup>
                        <div className="bg-white font-sans w-[280px]">
                            <div className={`p-4 text-white relative overflow-hidden ${
                                zone.default_risk === 'severe' ? 'bg-gradient-to-r from-rose-600 to-rose-700' :
                                zone.default_risk === 'high' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                zone.default_risk === 'medium' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'
                            }`}>
                                <div className="absolute top-0 right-0 p-4 opacity-20">
                                    <Waves size={64} />
                                </div>
                                <div className="relative z-10">
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full mb-2 inline-block">
                                        Khu vực {zone.district}
                                    </span>
                                    <h3 className="font-bold text-lg leading-tight pr-4">
                                        {zone.name}
                                    </h3>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Thoát nước</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <ArrowUpRight size={14} className={zone.properties.drainage === 'poor' ? 'text-red-500' : 'text-green-500'} />
                                            <span className="text-sm font-semibold capitalize text-slate-700">
                                                {zone.properties.drainage === 'poor' ? 'Kém' : zone.properties.drainage === 'moderate' ? 'TB' : 'Tốt'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Triều cường</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <Wind size={14} className="text-blue-500" />
                                            <span className="text-sm font-semibold text-slate-700">
                                                {(zone.simulation.tidal_sensitivity * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 flex justify-between items-center">
                                    <span>Độ cao nền: <span className="font-semibold capitalize">{zone.properties.elevation}</span></span>
                                    <span className="flex items-center gap-1 text-blue-600 cursor-pointer hover:underline">
                                        <Info size={12} /> Chi tiết
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Popup>
                </Polygon>
            );
        })}

        {/* Dynamic Flood Points with Clustering */}
        <FloodMarkers points={points} />

        {/* ORS Route Overlay */}
        {routeCoords && routeCoords.length > 1 && (
          <>
            <Polyline
              positions={routeCoords.map(p => [p.lat, p.lng])}
              pathOptions={{
                color: '#22d3ee',
                weight: 10,
                opacity: 0.25,
                className: 'route-neon-glow'
              }}
            />
            <Polyline
              positions={routeCoords.map(p => [p.lat, p.lng])}
              pathOptions={{
                color: '#7c3aed',
                weight: 6,
                opacity: 0.95,
                className: 'route-neon'
              }}
            />
            {routeEndpoints?.from && (
              <Marker
                position={[routeEndpoints.from.lat, routeEndpoints.from.lng]}
                icon={L.divIcon({
                  className: 'route-pin-start',
                  html: `
                    <div style="position: relative; width: 32px; height: 32px;">
                      <div style="position:absolute; inset:0; border-radius: 50%; background: rgba(34,197,94,0.2); box-shadow: 0 0 10px rgba(34,197,94,0.7);"></div>
                      <div style="position:absolute; inset:4px; border-radius: 50%; background: #10b981; border: 2px solid white; display:flex; align-items:center; justify-content:center;">
                        <div style="width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 10px solid white; transform: translateX(2px);"></div>
                      </div>
                    </div>
                  `,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                })}
              />
            )}
            {routeEndpoints?.to && (
              <Marker
                position={[routeEndpoints.to.lat, routeEndpoints.to.lng]}
                icon={L.divIcon({
                  className: 'route-pin-end',
                  html: `
                    <div style="position: relative; width: 32px; height: 32px;">
                      <div style="position:absolute; inset:0; border-radius: 50%; background: rgba(59,130,246,0.2); box-shadow: 0 0 10px rgba(59,130,246,0.7);"></div>
                      <div style="position:absolute; inset:4px; border-radius: 50%; background: #2563eb; border: 2px solid white; display:flex; align-items:center; justify-content:center;">
                        <div style="width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-right: 10px solid white; transform: translateX(-2px);"></div>
                      </div>
                    </div>
                  `,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                })}
              />
            )}
          </>
        )}

      </MapContainer>

      {/* Floating Controls Panel (Premium Look) */}
      <div className="absolute top-6 left-6 z-[400] flex flex-col gap-3">
         {/* Tracking Button */}
         <button 
            onClick={toggleTracking}
            className={`w-11 h-11 rounded-xl shadow-lg border backdrop-blur-md flex items-center justify-center transition-all duration-300 ${
                tracking 
                ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/40' 
                : 'bg-white/90 border-slate-200 text-slate-600 hover:text-blue-600 hover:scale-105'
            }`}
            title={tracking ? "Đang theo dõi" : "Bật GPS"}
         >
            {tracking ? <Compass className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
         </button>

         {/* Toggle Boundary Button */}
         <button 
            onClick={() => setShowBoundary(!showBoundary)}
            className={`w-11 h-11 rounded-xl shadow-lg border backdrop-blur-md flex items-center justify-center transition-all duration-300 ${
                showBoundary 
                ? 'bg-cyan-500/10 border-cyan-400 text-cyan-600 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
                : 'bg-white/90 border-slate-200 text-slate-600 hover:text-cyan-600'
            }`}
            title="Bật/Tắt ranh giới TP.HCM"
         >
            <Globe className="w-5 h-5" />
         </button>

         {/* Layer Switcher */}
         <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/50 p-1.5 flex flex-col gap-1.5">
             <button 
                onClick={() => setMapType('standard')}
                className={`p-2 rounded-lg transition-all ${mapType === 'standard' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                title="Bản đồ đường phố"
             >
                <MapPin className="w-5 h-5" />
             </button>
             <button 
                onClick={() => setMapType('satellite')}
                className={`p-2 rounded-lg transition-all ${mapType === 'satellite' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                title="Vệ tinh"
             >
                <Layers className="w-5 h-5" />
             </button>
             <button 
                onClick={() => setMapType('dark')}
                className={`p-2 rounded-lg transition-all ${mapType === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                title="Chế độ tối (VIP)"
             >
                <div className="w-5 h-5 rounded-full border-2 border-current bg-gradient-to-tr from-slate-700 to-slate-900"></div>
             </button>
         </div>
      </div>
    </div>
  );
};