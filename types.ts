
export interface WeatherInfo {
  temperature: number;
  humidity: number;
  description: string;
  icon?: string;
}

export interface FloodPoint {
  id?: string;
  lat: number;
  lng: number;
  depth: number; // cm
  locationName: string;
  severity: 'low' | 'medium' | 'high' | 'severe';
  timestamp: string;
}

export interface DashboardStats {
  totalAlerts: number;
  severeAlerts: number;
  safeDistricts: number;
  activeZones: number;
  avgWaterLevel?: number;
  sensorCount?: number;
  communityCount?: number;
  lastUpdated?: string;
}

export interface DistrictStat {
  id: string;
  name: string;
  alertCount: number;
  riskLevel: 'safe' | 'warning' | 'danger';
}

export interface PredictionHighRiskZone {
  id: string;
  name: string;
  predicted_risk: number;
}

export interface PredictionFactors {
  rain_probability: number;
  tidal_effect: number;
  current_flood_factor: number;
}

export interface Prediction {
  next_6h_risk: number; // 0-100
  risk_level: string;
  high_risk_zones: PredictionHighRiskZone[]; // Updated to object array
  advisory: {
    level?: string;
    message: string;
    actions: string[];
  };
  factors?: PredictionFactors; // New field
}

export interface RiskAnalysis {
  analysis: string;
  weatherSummary: string;
  floodData: any;
}

export interface AlertEnhanceResponse {
  success: boolean;
  description: string;
  water_level: number;
  district: string;
  severity: string;
}

export interface WeatherResponse {
  current: WeatherInfo;
  forecast: string;
}

export interface Report {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  locationName?: string;
  timestamp: string;
  status: string;
  images?: string[];
  waterLevel?: number;
  riskScore?: number;
  riskLevel?: string;
  address?: string;
  confidence?: string;
  reportedAt?: string;
  type?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Flood Zones
export interface FloodZoneProperties {
  elevation: 'low' | 'medium' | 'high';
  near_river: boolean;
  drainage: 'poor' | 'moderate' | 'good';
}

export interface FloodZoneSimulation {
  base_level: number;
  tidal_sensitivity: number;
  rain_sensitivity: number;
  drain_rate: number;
}

export interface FloodZone {
  id: string;
  name: string;
  district: string;
  polygon: [number, number][]; // Array of [lat, lng]
  center: [number, number];
  properties: FloodZoneProperties;
  simulation: FloodZoneSimulation;
  default_risk: 'low' | 'medium' | 'high' | 'severe';
}

// --- NEW WEATHER TYPES ---

export interface WeatherForecastItem {
  time: string; // ISO or HH:mm
  pop: number; // Probability of precipitation 0-1
  temp: number;
}

export interface DistrictWeatherData {
  district: string; // id
  districtName?: string; // friendly name if available
  temp: number;
  humidity: number;
  windSpeed?: number;
  isRaining: boolean;
  description: string;
  forecast: WeatherForecastItem[]; // 5h forecast
}

export interface WeatherSummary {
  rainyDistricts: number;
  districtsWithRainForecast: number;
  avgHumidity: number;
  maxTemp: number;
  avgFeelsLike?: number;
  maxRainProb?: {
    pop: number; // 0-1
    time?: string;
  };
}

export interface WeatherAllResponse {
  success: boolean;
  data: DistrictWeatherData[];
  summary: WeatherSummary;
  timestamp: string;
}

export interface WeatherAdviceResponse {
  advice: string;
  severity: 'low' | 'medium' | 'high';
  actions: string[];
}

export interface ChatResponse {
  success: boolean;
  reply: string; 
  session_id: string;
  timestamp: string;
  context_used?: any;
}
