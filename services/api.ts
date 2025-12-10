
import { DashboardStats, DistrictStat, FloodPoint, Prediction, Report, WeatherResponse, WeatherAllResponse, WeatherAdviceResponse, DistrictWeatherData, ChatResponse, RiskAnalysis, AlertEnhanceResponse } from '../types';

const BASE_URL = 'http://localhost:8000';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[API] Fetching: ${url}`, options);
    
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[API] Error ${res.status} ${res.statusText} for ${endpoint}:`, errorText);
      throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorText.substring(0, 200)}`);
    }
    
    const data = await res.json();
    console.log(`[API] Success for ${endpoint}:`, data);
    return data;
  } catch (error: any) {
    console.error(`[API] Fetch error for ${endpoint}:`, error);
    
    // Nếu là network error (CORS, connection refused, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`[API] Network error - có thể backend chưa chạy hoặc CORS issue. Backend URL: ${BASE_URL}`);
      throw new Error(`Không thể kết nối đến backend tại ${BASE_URL}. Vui lòng kiểm tra backend có đang chạy không.`);
    }
    
    throw error;
  }
}

// Flood helpers
// Calculate severity from water level (meters)
const calculateSeverity = (waterLevel: number): 'low' | 'medium' | 'high' | 'severe' => {
  if (!waterLevel || waterLevel <= 0) return 'low';
  const levelCm = waterLevel * 100; // convert m to cm
  if (levelCm < 20) return 'low';
  if (levelCm < 50) return 'medium';
  if (levelCm < 100) return 'high';
  return 'severe';
};

// Normalize severity strings returned by backend
const normalizeSeverity = (severity: string): 'low' | 'medium' | 'high' | 'severe' => {
  const s = (severity || 'low').toLowerCase();
  if (s.includes('severe') || s === 'severe') return 'severe';
  if (s.includes('high') || s === 'high') return 'high';
  if (s.includes('moderate') || s.includes('medium')) return 'medium';
  return 'low';
};

export const api = {
  getHealth: () => fetchJson<{ status: string, orion_ld: string, cratedb: string }>('/health'),
  
  // Dashboard
  getStats: async (lat?: number, lng?: number, radius?: number) => {
    let qs = '';
    if (lat && lng) qs = `?lat=${lat}&lng=${lng}&radius=${radius || 5}`;
    const response = await fetchJson<{
      total?: number;
      severe?: number;
      high?: number;
      medium?: number;
      low?: number;
      avgWaterLevel?: number;
      sensorCount?: number;
      communityCount?: number;
      lastUpdated?: string;
      filter?: any;
    }>(`/api/dashboard/stats${qs}`);
    
    // Map backend response to frontend DashboardStats type
    return {
      totalAlerts: response.total ?? 0,
      severeAlerts: response.severe ?? 0,
      safeDistricts: 0, // Will be calculated from districts if needed
      activeZones: (response.high ?? 0) + (response.medium ?? 0) + (response.low ?? 0),
      avgWaterLevel: response.avgWaterLevel ?? 0,
      sensorCount: response.sensorCount ?? 0,
      communityCount: response.communityCount ?? 0,
      lastUpdated: response.lastUpdated ?? new Date().toISOString(),
    } as DashboardStats;
  },
  
  getDistrictStats: async () => {
    const response = await fetchJson<{districts: any[], timestamp: string}>('/api/dashboard/districts');
    // Calculate safeDistricts from districts data
    const safeDistricts = response.districts?.filter((d: any) => 
      (d.severe || 0) === 0 && (d.high || 0) === 0
    ).length || 0;
    
    return {
      ...response,
      safeDistricts,
    };
  },
 
  getNearbyFloods: async (lat: number, lng: number, radius: number = 5, limit: number = 100) => {
    const res = await fetchJson<any>(`/api/flood/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`);
    const crowd = res.crowd_reports || [];
    const sensors = res.sensor_data || [];
    
    console.log('[API] getNearbyFloods response:', { crowdCount: crowd.length, sensorCount: sensors.length, sampleCrowd: crowd[0], sampleSensor: sensors[0] });
    
    // Map crowd reports - backend returns: risklevel (lowercase), lat, lng, waterlevel, address
    const crowdPoints = crowd.map((c: any) => {
      const waterLevel = c.waterlevel || c.waterLevel || 0;
      const severity = normalizeSeverity(c.risklevel || c.riskLevel || 'low');
      
      return {
        id: c.entity_id || c.id || `crowd-${Math.random()}`,
        lat: c.lat || 10.762622,
        lng: c.lng || 106.660172,
        depth: waterLevel * 100, // convert m to cm
        locationName: c.address || c.locationName || 'Tin báo cộng đồng',
        severity: severity,
        timestamp: c.calculatedat || c.timestamp || c.reportedAt || new Date().toISOString()
      };
    });
    
    // Map sensor data - backend returns: lat, lng, waterlevel, zoneid, zonename, district
    // Sensor may not have severity field, calculate from waterlevel
    const sensorPoints = sensors.map((s: any) => {
      const waterLevel = s.waterlevel || s.waterLevel || 0;
      const severity = s.severity ? normalizeSeverity(s.severity) : calculateSeverity(waterLevel);
      
      return {
        id: s.zoneid || s.zoneId || s.entity_id || `sensor-${Math.random()}`,
        lat: s.lat || 10.762622,
        lng: s.lng || 106.660172,
        depth: waterLevel * 100, // convert m to cm
        locationName: s.zonename || s.zoneName || s.zone_name || `Cảm biến ${s.zoneid || s.zoneId || 'N/A'}`,
        severity: severity,
        timestamp: s.time_index || s.updatedat || s.timestamp || s.observedAt || new Date().toISOString()
      };
    });
    
    const allPoints = [...crowdPoints, ...sensorPoints];
    console.log('[API] Mapped flood points:', allPoints.length, 'points');
    return allPoints;
  },
  
  // Prediction & Risk Analysis
  getPrediction: async () => {
    const response = await fetchJson<{ 
      success?: boolean;
      prediction: Prediction; 
      timestamp: string;
    }>('/api/flood/prediction');
    
    // Ensure prediction structure matches
    return {
      prediction: response.prediction,
      timestamp: response.timestamp,
    };
  },
  
  getRiskAnalysis: () => fetchJson<RiskAnalysis>('/api/flood/risk-analysis'),

  // Alerts Enhancement
  enhanceAlert: (waterLevel: number, district: string = 'Unknown', severity: string = 'High') => {
    // API expects query params
    const params = new URLSearchParams();
    params.append('water_level', waterLevel.toString());
    params.append('district', district);
    params.append('severity', severity);
    
    return fetchJson<AlertEnhanceResponse>(`/api/alerts/enhance?${params.toString()}`, { method: 'POST' });
  },

  enhanceBatchAlerts: (alerts: any[]) => 
    fetchJson<{success: boolean, alerts: any[]}>('/api/alerts/enhance-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts })
    }),

  // Reports
  getRecentReports: async (limit: number = 20, hours: number = 24) => {
    const response = await fetchJson<{
      reports: Report[];
      total?: number;
      hours?: number;
      timestamp?: string;
    }>(`/api/reports/recent?limit=${limit}&hours=${hours}`);
    
    // Map backend report fields to frontend Report type
    return response.reports.map((r: any) => ({
      id: r.id,
      latitude: r.lat,
      longitude: r.lng,
      description: r.description || '',
      locationName: r.address,
      timestamp: r.reportedAt || r.timestamp,
      status: r.status || 'active',
      images: r.images || r.image_urls || [],
      waterLevel: r.waterLevel || r.waterlevel,
      riskScore: r.riskScore || r.risk_score,
      riskLevel: r.riskLevel || r.risk_level,
      address: r.address,
      confidence: r.confidence,
      reportedAt: r.reportedAt || r.timestamp,
      type: r.type || 'community',
    } as Report));
  },
  
  getReportDetail: async (id: string) => {
    const r = await fetchJson<any>(`/api/reports/${id}`);
    
    // Map backend response to frontend Report type
    return {
      id: r.id,
      latitude: r.lat,
      longitude: r.lng,
      description: r.description || '',
      locationName: r.address,
      timestamp: r.reportedAt || r.timestamp,
      status: r.status || 'active',
      images: r.images || r.image_urls || [],
      waterLevel: r.waterLevel || r.waterlevel,
      riskScore: r.riskScore || r.risk_score,
      riskLevel: r.riskLevel || r.risk_level,
      address: r.address,
      confidence: r.confidence,
      reportedAt: r.reportedAt || r.timestamp,
      type: r.type || 'community',
      // Additional fields from backend if available
      ...(r.factors && { factors: r.factors }),
    } as Report;
  },

  submitReport: async (data: FormData) => {
    // Note: API v3.2 expects 'images' field for files, 'water_level', 'reporterId'
    // This is handled in the UI component before calling this, or we rely on FormData being correct
    const res = await fetch(`${BASE_URL}/report`, {
      method: 'POST',
      body: data, 
    });
    return res.json();
  },

  // Weather - Dashboard & Current
  // Backend returns {success, data: DistrictWeatherData[], total, timestamp}
  // We transform it to match WeatherResponse type for dashboard use
  getCurrentWeather: async (districtIds?: string[]) => {
      const qs = districtIds ? `?district_ids=${districtIds.join(',')}` : '';
      const response = await fetchJson<{
        success: boolean;
        data: DistrictWeatherData[];
        total: number;
        timestamp: string;
      }>(`/api/weather/current${qs}`);
      
      // Transform to WeatherResponse format for backward compatibility
      if (response.data && response.data.length > 0) {
          const first = response.data[0];
          return {
              current: {
                  temperature: first.temp,
                  humidity: first.humidity,
                  description: first.description,
              },
              forecast: response.data.map(d => `${d.district}: ${d.temp}°C`).join(', '),
          } as WeatherResponse;
      }
      
      // Fallback
      return {
          current: {
              temperature: 0,
              humidity: 0,
              description: 'N/A',
          },
          forecast: '',
      } as WeatherResponse;
  },
  
  // Weather - Full Page Module
  weather: {
    getDistricts: () => fetchJson<{districts: string[]}>('/api/weather/districts'),
    
    getCurrent: (districtIds?: string[]) => {
      const qs = districtIds ? `?district_ids=${districtIds.join(',')}` : '';
      return fetchJson<{success: boolean, data: DistrictWeatherData[]}>(`/api/weather/current${qs}`);
    },

    getAll: () => fetchJson<WeatherAllResponse>('/api/weather/all'),

    getDetail: (districtId: string) => fetchJson<DistrictWeatherData>(`/api/weather/${districtId}`),

    getAdvice: () => fetchJson<WeatherAdviceResponse>('/api/weather/advice'),
  },
  
  // Chat
  // Backend returns {success, response, session_id, timestamp, error?}
  // Map 'response' field to 'reply' for frontend compatibility
  sendMessage: async (message: string, sessionId?: string) => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId })
    });
    
    if (!res.ok) throw new Error('Chat API Error');
    const data = await res.json();
    
    // Map backend 'response' to frontend 'reply'
    return {
      success: data.success || true,
      reply: data.response || data.reply || 'Xin lỗi, không thể trả lời.',
      session_id: data.session_id || sessionId || '',
      timestamp: data.timestamp || new Date().toISOString(),
      context_used: data.context_used,
    } as ChatResponse;
  },

  clearChatSession: async (sessionId: string) => {
      return fetchJson<{success: boolean, message: string}>(`/api/chat/clear?session_id=${sessionId}`, { method: 'POST' });
  },

  getChatSession: (sessionId: string) => fetchJson<any>(`/api/chat/session/${sessionId}`),
};
