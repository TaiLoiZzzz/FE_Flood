
import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LayoutDashboard, Map as MapIcon, CloudRain, AlertTriangle, Menu, X, Plus, Radio, Droplets, ShieldCheck, RefreshCw, Bell, CloudSun, Waves, TrendingUp, Cpu, List, MapPin, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { FloodMap } from './components/FloodMap';
import { Chatbot } from './components/Chatbot';
import { ReportModal } from './components/ReportModal';
import { WeatherPage } from './components/WeatherPage';
import { api } from './services/api';
import { DashboardStats, FloodPoint, Prediction, WeatherResponse, RiskAnalysis, Report } from './types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const WS_URL = 'ws://localhost:8000/ws/map';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'weather'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [floodPoints, setFloodPoints] = useState<FloodPoint[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [districtStats, setDistrictStats] = useState<any>(null);

  // Analysis Modal State
  const [analysisReport, setAnalysisReport] = useState<Report | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fakeCrowdLoadedRef = useRef(false);
  const LOCAL_REPORT_KEY = 'floodwatch_local_reports';

  const FAKE_KEY = 'floodwatch_fake_crowd';

  const loadLocalReports = () => {
    try {
      const cached = localStorage.getItem(LOCAL_REPORT_KEY);
      if (!cached) return { reports: [], points: [] };
      const parsed = JSON.parse(cached);
      return {
        reports: parsed.reports || [],
        points: parsed.points || [],
      };
    } catch (e) {
      console.warn('Không đọc được local reports', e);
      return { reports: [], points: [] };
    }
  };

  const saveLocalReports = (reports: Report[], points: FloodPoint[]) => {
    try {
      localStorage.setItem(LOCAL_REPORT_KEY, JSON.stringify({ reports, points }));
    } catch (e) {
      console.warn('Không lưu được local reports', e);
    }
  };

  const loadFakeCrowd = () => {
    try {
      const cached = localStorage.getItem(FAKE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed;
      }
    } catch (e) {
      console.warn('Không đọc được fake crowd từ localStorage', e);
    }

    // Default vùng nhỏ Q1/Q4
    const baseLat = 10.77;
    const baseLng = 106.7;
    const fakeReports = Array.from({ length: 5 }).map((_, i) => {
      const lat = baseLat + (Math.random() - 0.5) * 0.01;
      const lng = baseLng + (Math.random() - 0.5) * 0.01;
      const depth = 30 + Math.random() * 50; // cm
      const riskLevel = depth > 70 ? 'Severe' : depth > 50 ? 'High' : 'Medium';
      return {
        id: `fake-${i}`,
        latitude: lat,
        longitude: lng,
        description: `Fake crowd report #${i + 1} - mực nước ~${depth.toFixed(0)}cm`,
        locationName: 'Khu vực demo',
        timestamp: new Date().toISOString(),
        status: 'active',
        images: [],
        waterLevel: depth / 100,
        riskScore: depth / 100,
        riskLevel,
        address: 'Q1 Demo',
        confidence: 'Demo',
        reportedAt: new Date().toISOString(),
        type: 'community',
      };
    });

    const fakePoints = fakeReports.map((r: any) => ({
      id: r.id,
      lat: r.latitude,
      lng: r.longitude,
      depth: (r.waterLevel || 0) * 100,
      locationName: r.address || 'Fake Crowd',
      severity: r.riskLevel?.toLowerCase().includes('severe')
        ? 'severe'
        : r.riskLevel?.toLowerCase().includes('high')
        ? 'high'
        : 'medium',
      timestamp: r.reportedAt,
    }));

    const payload = { fakeReports, fakePoints };
    try {
      localStorage.setItem(FAKE_KEY, JSON.stringify(payload));
    } catch {}
    return payload;
  };

  const fetchData = async () => {
    setLoading(true);
    setApiErrors({});
    
    try {
      console.log('[App] Starting data fetch...');
      
      // Test health check first
      try {
        const health = await api.getHealth();
        console.log('[App] Health check passed:', health);
      } catch (healthError: any) {
        console.error('[App] Health check failed:', healthError);
        setApiErrors({ general: `Backend không khả dụng: ${healthError.message}` });
        setLoading(false);
        return;
      }

      const [statsData, districtData, predData, weatherData, riskData, reportsData] = await Promise.all([
        api.getStats().catch((e) => {
          console.error('[App] getStats failed:', e);
          setApiErrors(prev => ({ ...prev, stats: e.message }));
          return null;
        }),
        api.getDistrictStats().catch((e) => {
          console.error('[App] getDistrictStats failed:', e);
          return null;
        }),
        api.getPrediction().catch((e) => {
          console.error('[App] getPrediction failed:', e);
          setApiErrors(prev => ({ ...prev, prediction: e.message }));
          return null;
        }),
        api.getCurrentWeather().catch((e) => {
          console.error('[App] getCurrentWeather failed:', e);
          setApiErrors(prev => ({ ...prev, weather: e.message }));
          return null;
        }),
        api.getRiskAnalysis().catch((e) => {
          console.error('[App] getRiskAnalysis failed:', e);
          return null;
        }),
        api.getRecentReports(10).catch((e) => {
          console.error('[App] getRecentReports failed:', e);
          setApiErrors(prev => ({ ...prev, reports: e.message }));
          return [];
        })
      ]);
      
      console.log('[App] Data fetched:', { statsData, districtData, predData, weatherData, riskData, reportsData });
      
      if (statsData) {
        // Calculate safeDistricts from district stats if available
        if (districtData && districtData.safeDistricts !== undefined) {
          setStats({
            ...statsData,
            safeDistricts: districtData.safeDistricts,
          });
        } else {
          setStats(statsData);
        }
      }
      
      if (districtData) setDistrictStats(districtData);
      if (predData?.prediction) setPrediction(predData.prediction);
      if (weatherData) setWeather(weatherData);
      if (riskData) setRiskAnalysis(riskData);
      if (reportsData) setRecentReports(reportsData);

      // Fetch nearby floods map points via REST as backup/initial load
      try {
        const lat = userLocation?.lat || 10.762622;
        const lng = userLocation?.lng || 106.660172;
        const points = await api.getNearbyFloods(lat, lng, 10);
        console.log('[App] Nearby floods:', points);
        setFloodPoints(points || []);
      } catch (e) {
        console.error('[App] getNearbyFloods failed:', e);
        setApiErrors(prev => ({ ...prev, floods: e.message }));
      }

      // Nạp báo cáo local (tồn tại sau F5)
      const local = loadLocalReports();
      if (local.reports.length) {
        setRecentReports(prev => [...local.reports, ...(prev || [])]);
        setFloodPoints(prev => [...prev, ...local.points]);
      }

      // Fallback fake crowd nếu không có dữ liệu cộng đồng
      if (!fakeCrowdLoadedRef.current) {
        const { fakeReports, fakePoints } = loadFakeCrowd();
        if (fakeReports?.length) {
          setRecentReports(prev => (prev && prev.length > 0 ? prev : fakeReports));
          setFloodPoints(prev => [...prev, ...fakePoints]);
          fakeCrowdLoadedRef.current = true;
        }
      }
      
      setLastUpdated(new Date());

    } catch (err: any) {
      console.error("[App] Initialization error", err);
      setApiErrors({ general: err.message || 'Lỗi không xác định' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error(err)
      );
    }
  }, []);

  // WebSocket Connection
  useEffect(() => {
    console.log('[WS] Attempting connection to', WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    
    ws.onopen = () => {
        console.log("[WS] ✅ Connected to Flood Stream");
        // Send INIT message as per API docs
        const initMsg = {
            type: 'init',
            lat: userLocation?.lat || 10.762622,
            lng: userLocation?.lng || 106.660172,
            radius: 20 // Get wide area
        };
        console.log('[WS] Sending init:', initMsg);
        ws.send(JSON.stringify(initMsg));
        
        // Poll for incremental updates
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'poll' }));
          }
        }, 7000);
    };
    
    ws.onclose = (event) => {
        console.log('[WS] ❌ Connection closed:', event.code, event.reason);
    };
    
    ws.onerror = (error) => {
        console.error('[WS] ❌ WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newPoints: FloodPoint[] = [];
        
        // Handle Snapshot or Update
        if(data.type === 'snapshot' || data.type === 'update') {
          console.log('[WS] Received data:', { type: data.type, crowdCount: data.crowd?.length, sensorCount: data.sensor?.length });
          
          // Helper functions
          const normalizeSeverity = (severity: string): 'low' | 'medium' | 'high' | 'severe' => {
            const s = (severity || 'low').toLowerCase();
            if (s.includes('severe') || s === 'severe') return 'severe';
            if (s.includes('high') || s === 'high') return 'high';
            if (s.includes('moderate') || s.includes('medium')) return 'medium';
            return 'low';
          };
          
          const calculateSeverity = (waterLevel: number): 'low' | 'medium' | 'high' | 'severe' => {
            if (!waterLevel || waterLevel <= 0) return 'low';
            const levelCm = waterLevel * 100;
            if (levelCm < 20) return 'low';
            if (levelCm < 50) return 'medium';
            if (levelCm < 100) return 'high';
            return 'severe';
          };
          
          // Process crowd reports - backend: risklevel (lowercase), lat, lng, waterlevel, address
          if(data.crowd && Array.isArray(data.crowd)) {
            newPoints.push(...data.crowd.map((c:any) => {
              const waterLevel = c.waterlevel || 0;
              const severity = normalizeSeverity(c.risklevel || 'low');
              
              return {
                id: c.entity_id || c.id || `ws-crowd-${Math.random()}`,
                lat: c.lat || 10.762622,
                lng: c.lng || 106.660172,
                depth: waterLevel * 100,
                locationName: c.address || 'Tin mới (Live)',
                severity: severity,
                timestamp: c.calculatedat || c.timestamp || new Date().toISOString()
              };
            }));
          }
          
          // Process sensor data - backend: lat, lng, waterlevel, zoneid, zonename
          if(data.sensor && Array.isArray(data.sensor)) {
            newPoints.push(...data.sensor.map((s:any) => {
              const waterLevel = s.waterlevel || 0;
              const severity = s.severity ? normalizeSeverity(s.severity) : calculateSeverity(waterLevel);
              
              return {
                id: s.zoneid || s.entity_id || `ws-sensor-${Math.random()}`,
                lat: s.lat || 10.762622,
                lng: s.lng || 106.660172,
                depth: waterLevel * 100,
                locationName: s.zonename || s.zoneName || `Sensor ${s.zoneid || 'N/A'}`,
                severity: severity,
                timestamp: s.time_index || s.updatedat || s.timestamp || new Date().toISOString()
              };
            }));
          }
          
          console.log('[WS] Processed', newPoints.length, 'new points');
        }

        if(newPoints.length > 0) {
            setFloodPoints(prev => {
                const updated = [...prev];
                newPoints.forEach(p => {
                     // Check existing based on fuzzy location or ID
                     const idx = updated.findIndex(ex => 
                        ex.id === p.id || 
                        (Math.abs(ex.lat - p.lat) < 0.0001 && Math.abs(ex.lng - p.lng) < 0.0001)
                     );
                     
                     if(idx >= 0) updated[idx] = { ...updated[idx], ...p };
                     else updated.push(p);
                });
                return updated;
            });
        }

        // Inject fake crowd via ws effect nếu chưa có
        if (!fakeCrowdLoadedRef.current) {
          const { fakeReports, fakePoints } = loadFakeCrowd();
          if (fakeReports?.length) {
            setRecentReports(prev => (prev && prev.length > 0 ? prev : fakeReports));
            setFloodPoints(prev => [...prev, ...fakePoints]);
            fakeCrowdLoadedRef.current = true;
          }
        }
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    ws.onerror = (e) => console.error("WebSocket Error:", e);

    return () => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        if (ws.readyState === 1) ws.close();
        wsRef.current = null;
    };
  }, [userLocation]); // Re-connect if user location is determined to get accurate init data

  const handleEnhanceAlert = async (report: Report) => {
      setAnalysisReport(report);
      setIsAnalyzing(true);
      setAnalysisResult(null);

      try {
          const res = await api.enhanceAlert(report.waterLevel || 0.5, 'Unknown', report.riskLevel);
          setAnalysisResult(res.description);
      } catch(e) {
          setAnalysisResult("Không thể kết nối với AI để phân tích lúc này.");
      } finally {
          setIsAnalyzing(false);
      }
  }

  const closeAnalysis = () => {
      setAnalysisReport(null);
      setAnalysisResult(null);
  }

  const riskLevel = prediction?.risk_level || 'Low';
  const riskColor = riskLevel.includes('High') || riskLevel.includes('Danger') || riskLevel.includes('CAO') ? 'text-rose-500' : riskLevel.includes('Medium') || riskLevel.includes('Warning') || riskLevel.includes('TRUNG BÌNH') ? 'text-amber-500' : 'text-emerald-500';

  const handleLocalReport = (report: Report, point: FloodPoint) => {
    setRecentReports(prev => {
      const next = [report, ...(prev || [])];
      const locals = loadLocalReports();
      saveLocalReports([report, ...locals.reports], [point, ...locals.points]);
      return next;
    });

    setFloodPoints(prev => [point, ...prev]);

    setStats(prev => prev ? { ...prev, totalAlerts: (prev.totalAlerts || 0) + 1, communityCount: (prev.communityCount || 0) + 1 } : prev);
    setLastUpdated(new Date());
  };

  return (
    <div className="flex h-screen bg-[#F0F4F8] overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-slate-200/60 transform transition-transform duration-300 lg:transform-none flex flex-col shadow-2xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center px-8 border-b border-slate-100/60 bg-gradient-to-b from-white to-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 text-white">
              <CloudRain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight tracking-tight">FloodMonitor</h1>
              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">HCMC System</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>

        <nav className="p-6 space-y-2 flex-1 overflow-y-auto">
          <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Tổng quan</p>
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<MapIcon size={20} />} 
            label="Bản đồ ngập" 
            active={activeTab === 'map'} 
            onClick={() => { setActiveTab('map'); setSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<CloudSun size={20} />} 
            label="Thời tiết & Cảnh báo" 
            active={activeTab === 'weather'} 
            onClick={() => { setActiveTab('weather'); setSidebarOpen(false); }} 
          />
          
          <div className="my-6 border-t border-slate-100/80"></div>
          
          <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Cá nhân</p>
           <button 
            onClick={() => setIsReportModalOpen(true)}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 group"
          >
            <span className="bg-slate-100 text-slate-500 p-1.5 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
              <Plus size={16} />
            </span>
            <span>Gửi báo cáo</span>
          </button>
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse"></div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Hệ thống ổn định</p>
                <p className="text-[10px] text-slate-400">Orion-LD: Connected</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-white/50">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 z-30 sticky top-0 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors">
              <Menu size={24} />
            </button>
            <div>
               <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                {activeTab === 'dashboard' ? 'Trung tâm giám sát' : activeTab === 'map' ? 'Bản đồ trực tuyến' : 'Dự báo thời tiết'}
              </h2>
              <p className="text-xs text-slate-500 hidden sm:block">
                Cập nhật lúc: {lastUpdated.toLocaleTimeString('vi-VN')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
                onClick={fetchData}
                disabled={loading}
                className={`p-2.5 rounded-full text-slate-500 hover:bg-slate-100 transition-all ${loading ? 'animate-spin bg-blue-50 text-blue-500' : ''}`}
                title="Làm mới dữ liệu"
            >
                <RefreshCw size={20} />
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <button className="relative p-2.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
                <Bell size={20} />
                {stats?.severeAlerts ? (
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                ) : null}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth scrollbar-hide">
          {/* API Error Display */}
          {Object.keys(apiErrors).length > 0 && (
            <div className="max-w-7xl mx-auto mb-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="text-red-500 mr-3" size={20} />
                  <div>
                    <h3 className="text-red-800 font-bold text-sm mb-1">Lỗi kết nối API</h3>
                    {Object.entries(apiErrors).map(([key, msg]) => (
                      <p key={key} className="text-red-700 text-xs">
                        {key === 'general' ? msg : `${key}: ${msg}`}
                      </p>
                    ))}
                    <p className="text-red-600 text-xs mt-2">
                      Backend URL: http://localhost:8000 - Vui lòng kiểm tra backend có đang chạy không.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'dashboard' ? (
            <div className="max-w-7xl mx-auto space-y-6 pb-24">
              
              {/* Top Stats Row */}
              {loading && !stats && !weather && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
                  <span className="text-slate-600 font-medium">Đang tải dữ liệu từ backend...</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <StatCard 
                  title="Điểm ngập active" 
                  value={stats?.totalAlerts ?? '--'} 
                  icon={<Radio className="text-blue-600" size={22} />} 
                  color="blue"
                  subtext={stats ? "Toàn thành phố" : "Đang tải..."}
                />
                <StatCard 
                  title="Mức độ nghiêm trọng" 
                  value={stats?.severeAlerts ?? '--'} 
                  icon={<AlertTriangle className="text-rose-600" size={22} />} 
                  color="rose"
                  subtext="Cần xử lý ngay"
                  highlight={stats?.severeAlerts && stats.severeAlerts > 0}
                />
                 <StatCard 
                  title="Khu vực an toàn" 
                  value={stats ? `${stats.safeDistricts || 0}/22` : '--'} 
                  icon={<ShieldCheck className="text-emerald-600" size={22} />} 
                  color="emerald"
                  subtext="Quận/Huyện"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                <div className="xl:col-span-2 space-y-6">
                    {/* Prediction Card */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-bl-full opacity-50 pointer-events-none -z-0"></div>
                        
                        <div className="flex flex-col md:flex-row gap-10 items-center relative z-10">
                            {/* Circular Gauge */}
                            <div className="relative w-48 h-48 flex-shrink-0">
                                <svg className="transform -rotate-90 w-full h-full filter drop-shadow-xl">
                                    <circle cx="96" cy="96" r="88" stroke="#f1f5f9" strokeWidth="16" fill="transparent" strokeLinecap="round" />
                                    <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="16" fill="transparent" 
                                            className={`${riskColor} transition-all duration-1000 ease-out`} 
                                            strokeDasharray={552} 
                                            strokeDashoffset={552 - (552 * ((prediction?.next_6h_risk || 0) * 100)) / 100} 
                                            strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-5xl font-extrabold ${riskColor} tracking-tighter`}>{((prediction?.next_6h_risk || 0) * 100).toFixed(0)}<span className="text-2xl align-top">%</span></span>
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Rủi ro</span>
                                </div>
                            </div>

                            <div className="flex-1 text-center md:text-left space-y-5">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 mb-3 border border-slate-200">
                                        <div className={`w-2 h-2 rounded-full ${riskColor.replace('text-', 'bg-')}`}></div>
                                        <span className="text-xs font-bold text-slate-600 uppercase">Dự báo 6 giờ tới</span>
                                    </div>
                                    <h3 className="text-3xl font-bold text-slate-800 leading-tight">
                                        {prediction?.advisory.message || 'Đang phân tích dữ liệu...'}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                         <p className="text-xs text-slate-500 font-semibold mb-1">Mức độ cảnh báo</p>
                                         <p className={`text-lg font-bold ${riskColor}`}>{prediction?.risk_level || 'Unknown'}</p>
                                     </div>
                                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                         <p className="text-xs text-slate-500 font-semibold mb-1">Thời tiết</p>
                                         <p className="text-lg font-bold text-slate-700 capitalize">{weather?.current.description || '--'}</p>
                                     </div>
                                </div>
                                
                                {prediction?.factors && (
                                     <div className="flex gap-4 pt-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-blue-50 px-2.5 py-1.5 rounded-lg">
                                            <CloudRain size={14} className="text-blue-500"/>
                                            Mưa: {(prediction.factors.rain_probability * 100).toFixed(0)}%
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-cyan-50 px-2.5 py-1.5 rounded-lg">
                                            <Waves size={14} className="text-cyan-500"/>
                                            Triều cường: {(prediction.factors.tidal_effect * 100).toFixed(0)}%
                                        </div>
                                     </div>
                                )}
                            </div>
                        </div>

                        {/* High Risk Zones */}
                        <div className="mt-8 pt-6 border-t border-slate-100">
                             <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <MapIcon size={16} className="text-slate-400" />
                                Khu vực dự báo nguy cơ cao
                             </h4>
                             <div className="flex flex-wrap gap-2">
                                {prediction?.high_risk_zones && prediction.high_risk_zones.length > 0 ? (
                                    prediction.high_risk_zones.map((zone, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-sm font-semibold flex items-center gap-1.5 group cursor-help" title={`Rủi ro: ${(zone.predicted_risk * 100).toFixed(0)}%`}>
                                            <AlertTriangle size={12} className="group-hover:animate-bounce"/>
                                            {zone.name}
                                            <span className="opacity-60 text-xs ml-0.5">({(zone.predicted_risk * 100).toFixed(0)}%)</span>
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-slate-400 text-sm italic">Không có cảnh báo khu vực đặc biệt</span>
                                )}
                             </div>
                        </div>
                    </div>

                    {/* AI Risk Analysis Card */}
                    {riskAnalysis && (
                        <div className="bg-indigo-900 text-white rounded-[2rem] p-8 shadow-xl shadow-indigo-900/20 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Cpu size={120} />
                             </div>
                             <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-white/10 flex items-center gap-2">
                                        <Cpu size={14} /> AI Analysis
                                    </span>
                                </div>
                                <div className="prose prose-invert prose-sm max-w-none text-indigo-50">
                                    <ReactMarkdown remarkPlugins={[remarkGfm as any]}>
                                        {riskAnalysis.analysis || ''}
                                    </ReactMarkdown>
                                </div>
                                <p className="text-indigo-200 text-sm italic border-t border-white/10 pt-4 mt-4">
                                    {(() => {
                                        const ws = riskAnalysis.weatherSummary as any;
                                        if (!ws) return 'Thời tiết: N/A';
                                        if (typeof ws === 'string') return `Thời tiết: ${ws}`;
                                        if (typeof ws === 'object') {
                                            const avgTemp = ws.avgTemperature ?? ws.temperature ?? '--';
                                            const avgHum = ws.avgHumidity ?? ws.humidity ?? '--';
                                            const rainy = ws.rainyDistricts ?? ws.rain ?? 0;
                                            const total = ws.totalDistricts ?? ws.total ?? '--';
                                            const forecast = ws.districtsWithRainForecast ?? ws.forecast ?? '--';
                                            return `Thời tiết: ${avgTemp}°C · Ẩm: ${avgHum}% · Mưa: ${rainy}/${total} quận · Dự báo mưa: ${forecast}`;
                                        }
                                        return 'Thời tiết: N/A';
                                    })()}
                                </p>
                             </div>
                        </div>
                    )}
                </div>

                {/* Side Panel */}
                <div className="space-y-6">
                    {/* Mini Chart */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col h-[280px]">
                        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center justify-between">
                            <span>Phân bố theo Quận</span>
                            <span className="p-1.5 bg-slate-50 rounded-lg text-slate-400"><Radio size={14}/></span>
                        </h3>
                        <div className="flex-1 -ml-4">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: 'Q1', value: 2 }, { name: 'Q2', value: 5 }, 
                                    { name: 'Q7', value: 8 }, { name: 'BT', value: 12 }, 
                                    { name: 'TĐ', value: 6 }
                                ]} barSize={24}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                                    <Tooltip 
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                                        {[2,5,8,12,6].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry > 10 ? '#f43f5e' : entry > 5 ? '#fb923c' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                             </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Community Reports Feed */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
                        <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center justify-between">
                            <span>Tin báo cộng đồng</span>
                            <span className="text-xs text-blue-500 font-bold bg-blue-50 px-2 py-1 rounded-md cursor-pointer hover:bg-blue-100">Xem tất cả</span>
                        </h3>
                        {apiErrors.reports && (
                          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">
                            Không tải được tin báo cộng đồng: {apiErrors.reports}
                          </div>
                        )}
                        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                            {recentReports.length > 0 ? (
                                recentReports.map((report, i) => (
                                    <div key={i} className="flex gap-3 items-start p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${report.riskLevel?.includes('High') || report.riskLevel?.includes('Severe') ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-slate-800 line-clamp-1">{report.address || 'Vị trí không xác định'}</p>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                    {report.reportedAt ? new Date(report.reportedAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : 'Vừa xong'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                                {report.description || `Mực nước ghi nhận: ${(report.waterLevel || 0) * 100}cm`}
                                            </p>
                                            
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                                                    {report.confidence || 'Chưa xác thực'}
                                                </span>
                                                {(report.riskLevel?.includes('High') || report.riskLevel?.includes('Severe')) && (
                                                    <button 
                                                        onClick={() => handleEnhanceAlert(report)}
                                                        className="text-[10px] flex items-center gap-1 text-indigo-600 font-bold hover:underline transition-colors hover:text-indigo-800"
                                                    >
                                                        <Cpu size={10} /> AI Analyze
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Chưa có báo cáo nào gần đây</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              {/* Actionable Recommendations */}
              {prediction?.advisory.actions && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck size={180} />
                  </div>
                  <div className="relative z-10">
                     <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <ShieldCheck className="text-emerald-400" />
                        Khuyến nghị hành động
                     </h3>
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {prediction.advisory.actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-4 bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-sm font-bold">{i + 1}</div>
                            <span className="text-slate-200 text-sm leading-relaxed font-medium">{action}</span>
                        </div>
                        ))}
                     </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'map' ? (
            <div className="h-[calc(100vh-8rem)] rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-200 relative group">
               <FloodMap points={floodPoints} />
               
               <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-4 border border-white/50 w-[240px]">
                  <h4 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-wider text-center">Chỉ dẫn bản đồ</h4>
                  <div className="space-y-2">
                    <MapLegendItem color="bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" label="Thấp (<20cm)" />
                    <MapLegendItem color="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" label="Trung bình (20-40cm)" />
                    <MapLegendItem color="bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" label="Cao (40-60cm)" />
                    <MapLegendItem color="bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.5)] animate-pulse" label="Nghiêm trọng (>60cm)" />
                  </div>
               </div>
            </div>
          ) : (
            <WeatherPage />
          )}
        </div>

        <Chatbot />
        <ReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)}
          onReportCreated={handleLocalReport}
          userLat={userLocation?.lat}
          userLng={userLocation?.lng}
        />

        {/* AI Analysis Modal */}
        {analysisReport && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                 <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeAnalysis}></div>
                 <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                      <div className="p-6">
                           <div className="flex justify-between items-center mb-6">
                               <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                       <Cpu size={20} />
                                   </div>
                                   <div>
                                       <h3 className="text-lg font-bold text-slate-800">AI Risk Analysis</h3>
                                       <p className="text-xs text-slate-500">{analysisReport.address}</p>
                                   </div>
                               </div>
                               <button onClick={closeAnalysis} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                                   <X size={20} />
                               </button>
                           </div>

                           <div className="min-h-[200px] bg-slate-50 rounded-2xl p-6 border border-slate-100 relative">
                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-indigo-400 rounded-full animate-ping opacity-20"></div>
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm relative z-10">
                                                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">Đang phân tích dữ liệu...</p>
                                            <p className="text-xs text-slate-400 mt-1">Đánh giá mực nước, độ sâu và hình ảnh</p>
                                        </div>
                                    </div>
                                ) : analysisResult ? (
                                    <div className="animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex gap-2 mb-3">
                                            <Sparkles size={16} className="text-amber-500 mt-0.5" />
                                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Đánh giá chi tiết</h4>
                                        </div>
                                        <div className="prose prose-sm text-slate-700 max-w-none prose-headings:text-slate-800 prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
                                            <ReactMarkdown remarkPlugins={[remarkGfm as any]}>
                                                {analysisResult}
                                            </ReactMarkdown>
                                        </div>
                                        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                            <CheckCircle2 size={14} />
                                            Phân tích hoàn tất bởi Gemini Pro
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-rose-500 text-sm">
                                        Không thể tải dữ liệu phân tích.
                                    </div>
                                )}
                           </div>
                      </div>
                      <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                           <button onClick={closeAnalysis} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                               Đóng cửa sổ
                           </button>
                      </div>
                 </div>
            </div>
        )}
      </main>
    </div>
  );
};

// Components
const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group relative overflow-hidden ${
      active 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
      : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
    }`}
  >
    <span className={`transition-colors relative z-10 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`}>
      {icon}
    </span>
    <span className="relative z-10">{label}</span>
  </button>
);

const StatCard = ({ title, value, icon, color, subtext, highlight = false }: { title: string, value: string | number, icon: React.ReactNode, color: 'blue' | 'amber' | 'rose' | 'emerald', subtext?: string, highlight?: boolean }) => {
  const bgColors = {
    blue: 'bg-blue-50',
    amber: 'bg-amber-50',
    rose: 'bg-rose-50',
    emerald: 'bg-emerald-50'
  };
  const ringColors = {
    blue: 'group-hover:ring-blue-100',
    amber: 'group-hover:ring-amber-100',
    rose: 'group-hover:ring-rose-100',
    emerald: 'group-hover:ring-emerald-100'
  };

  return (
    <div className={`bg-white p-5 rounded-3xl shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md group ring-4 ring-transparent ${ringColors[color]} ${highlight ? 'ring-rose-50 border-rose-100 bg-rose-50/10' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl ${bgColors[color]} transition-transform group-hover:scale-110 duration-300`}>{icon}</div>
      </div>
      <div>
        <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
        <div className="text-2xl font-bold text-slate-800 tracking-tight">{value}</div>
        {subtext && <p className="text-xs text-slate-400 font-medium mt-1">{subtext}</p>}
      </div>
    </div>
  );
};

const MapLegendItem = ({ color, label }: { color: string, label: string }) => (
  <div className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
    <div className={`w-3 h-3 rounded-full ring-2 ring-white ${color}`}></div> 
    <span className="text-slate-600 text-xs font-semibold">{label}</span>
  </div>
);

export default App;
