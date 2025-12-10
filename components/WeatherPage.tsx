
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { WeatherAllResponse, WeatherAdviceResponse, DistrictWeatherData } from '../types';
import { CloudRain, Sun, Cloud, Wind, Droplets, ArrowUp, Umbrella, Thermometer, MapPin, Loader2, Search, X } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

export const WeatherPage: React.FC = () => {
  const [data, setData] = useState<WeatherAllResponse | null>(null);
  const [advice, setAdvice] = useState<WeatherAdviceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rain' | 'name' | 'humidity'>('rain');
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);

  const formatNumber = (value: number | null | undefined, digits: number = 0) => {
    return typeof value === 'number' ? value.toFixed(digits) : '--';
  };

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        console.log('[WeatherPage] Fetching weather data...');
        // Theo tài liệu backend: /api/weather/current?district_ids=q1,q7,...
        const defaultDistrictIds = [
          'q1','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12',
          'binh_tan','binh_thanh','go_vap','phu_nhuan','tan_binh','tan_phu',
          'thu_duc','binh_chanh','can_gio','cu_chi','hoc_mon','nha_be'
        ];
        const currentRes = await api.weather.getCurrent(defaultDistrictIds).catch(e => {
          console.error('[WeatherPage] getCurrent failed:', e);
          throw e;
        });
        // Chuẩn hóa payload backend => DistrictWeatherData
        const mappedData: DistrictWeatherData[] = (currentRes?.data || []).map((d: any) => {
          const forecast = (d.forecast || []).map((f: any) => ({
            time: f.hour || f.datetime || '',
            pop: typeof f.pop === 'number' ? f.pop / 100 : 0,
            temp: f.temp ?? f.temperature ?? 0,
          }));
          const descRaw = d.conditionText || d.condition || d.description || '';
          const desc = typeof descRaw === 'string' ? descRaw : '';
          const temp = d.temperature ?? d.temp ?? 0;
          const humidity = d.humidity ?? 0;
          const feelsLike = d.feelsLike ?? d.temperature ?? temp;
          const isRaining = String(d.condition || '').toLowerCase().includes('rain') || desc.toLowerCase().includes('mưa');
          return {
            district: typeof d.id === 'string' ? d.id : 'unknown',
            districtName: typeof d.location === 'string' ? d.location : (typeof d.id === 'string' ? d.id : 'Không rõ quận'),
            temp,
            humidity,
            feelsLike,
            windSpeed: d.windSpeed,
            isRaining,
            description: desc,
            forecast,
          };
        });
        // Chuẩn hóa thành WeatherAllResponse để UI dùng chung
        const summary = (() => {
          const list = mappedData;
          const rainyDistricts = list.filter(d => d.isRaining).length;
          const districtsWithRainForecast = list.filter(d => (d.forecast || []).some(f => (f.pop || 0) > 0.4)).length;
          const avgHumidity = list.length ? list.reduce((s, d) => s + (d.humidity || 0), 0) / list.length : 0;
          const maxTemp = list.length ? Math.max(...list.map(d => typeof d.temp === 'number' ? d.temp : -Infinity)) : 0;
          const avgFeelsLike = list.length ? list.reduce((s, d) => s + (d.feelsLike || d.temp || 0), 0) / list.length : 0;
          const maxRain = (() => {
            let pop = 0;
            let time = '';
            list.forEach(d => {
              (d.forecast || []).forEach(f => {
                if ((f.pop || 0) > pop) {
                  pop = f.pop || 0;
                  time = f.time || '';
                }
              });
            });
            return { pop, time };
          })();
          return { rainyDistricts, districtsWithRainForecast, avgHumidity, maxTemp, avgFeelsLike, maxRainProb: maxRain };
        })();
        const weatherData = {
          success: currentRes?.success ?? true,
          data: mappedData,
          summary,
          timestamp: new Date().toISOString(),
        } as WeatherAllResponse;
        // Advice backend đang 404, tạm bỏ qua để tránh log lỗi
        const adviceData = null;
        console.log('[WeatherPage] Weather data received:', { 
          hasData: !!weatherData, 
          districtCount: weatherData?.data?.length,
          hasAdvice: !!adviceData 
        });
        setData(weatherData);
        setAdvice(adviceData);
      } catch (e: any) {
        console.error("[WeatherPage] Failed to load weather data:", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  const getWeatherIcon = (isRaining?: boolean, desc: string = '') => {
    if (isRaining) return <CloudRain className="w-8 h-8 text-blue-500" />;
    if (desc.toLowerCase().includes('cloud') || desc.toLowerCase().includes('mây')) return <Cloud className="w-8 h-8 text-slate-500" />;
    return <Sun className="w-8 h-8 text-amber-500" />;
  };

  const enhancedList = useMemo(() => {
    const list = data?.data || [];
    return list.map((d) => {
      const maxPop = (d.forecast || []).reduce((m, f) => Math.max(m, f.pop || 0), 0);
      const nextHours = (d.forecast || []).slice(0, 3);
      return { ...d, maxPop, nextHours };
    });
  }, [data?.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = enhancedList;
    if (term) {
      list = list.filter(d => 
        (d.districtName || '').toLowerCase().includes(term) ||
        (d.district || '').toLowerCase().includes(term)
      );
    }
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'rain') return (b.maxPop || 0) - (a.maxPop || 0);
      if (sortBy === 'humidity') return (b.humidity || 0) - (a.humidity || 0);
      return (a.districtName || a.district || '').localeCompare(b.districtName || b.district || '');
    });
    return sorted;
  }, [enhancedList, search, sortBy]);

  const topRisk = useMemo(() => filtered.slice(0, 3), [filtered]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
        <p className="text-sm font-medium">Đang cập nhật dữ liệu khí tượng...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 transform scale-150">
             <CloudRain size={100} />
          </div>
          <div className="relative z-10">
            <p className="text-blue-100 text-sm font-medium mb-1">Khu vực có mưa</p>
            <h3 className="text-4xl font-bold tracking-tight">{data?.summary?.rainyDistricts || 0}<span className="text-xl text-blue-200">/22</span></h3>
            <p className="text-xs text-blue-200 mt-2 flex items-center gap-1">
               <ArrowUp size={12} /> {data?.summary?.districtsWithRainForecast || 0} quận sắp mưa
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Độ ẩm TB</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(data?.summary?.avgHumidity, 0)}%</h3>
           </div>
           <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <Droplets size={24} />
           </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Nhiệt độ Max</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(data?.summary?.maxTemp, 1)}°C</h3>
           </div>
           <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <Thermometer size={24} />
           </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Nguy cơ mưa 5h tới</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">
                {formatNumber((data?.summary?.maxRainProb?.pop || 0) * 100, 0)}%
                <span className="text-xs text-slate-400 ml-2">{data?.summary?.maxRainProb?.time || ''}</span>
              </h3>
           </div>
           <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <CloudRain size={24} />
           </div>
        </div>
      </div>

      {/* Top nguy cơ mưa */}
      <div className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-800">Top 3 khu vực nguy cơ mưa cao</h4>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
              <Search size={14} className="text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm quận..."
                className="bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 w-40"
              />
            </div>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setSortBy('rain')} className={`px-3 py-1 rounded-full border ${sortBy==='rain'?'bg-blue-50 text-blue-600 border-blue-200':'border-slate-200 text-slate-500'}`}>Nguy cơ</button>
              <button onClick={() => setSortBy('humidity')} className={`px-3 py-1 rounded-full border ${sortBy==='humidity'?'bg-blue-50 text-blue-600 border-blue-200':'border-slate-200 text-slate-500'}`}>Độ ẩm</button>
              <button onClick={() => setSortBy('name')} className={`px-3 py-1 rounded-full border ${sortBy==='name'?'bg-blue-50 text-blue-600 border-blue-200':'border-slate-200 text-slate-500'}`}>Tên</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {topRisk.map((d, idx) => (
            <div key={d.district || idx} className="rounded-xl border border-slate-100 p-3 bg-slate-50/60">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">#{idx+1} {d.districtName}</p>
                  <p className="text-sm font-semibold text-slate-800">{formatNumber((d.maxPop||0)*100,0)}% mưa</p>
                </div>
                <CloudRain className="text-blue-500" size={18} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{typeof d.temp==='number'?`${d.temp}°C`:'--'}</span>
                <span>{d.humidity ?? '--'}% ẩm</span>
                <span>{d.nextHours?.[0]?.time || ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. AI Advice Section */}
      {advice && (
        <div className="relative overflow-hidden rounded-[2rem] p-8 shadow-xl">
           <div className={`absolute inset-0 opacity-90 ${
               advice.severity === 'high' ? 'bg-gradient-to-r from-rose-500 to-orange-600' :
               advice.severity === 'medium' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
               'bg-gradient-to-r from-emerald-500 to-teal-600'
           }`}></div>
           
           <div className="relative z-10 text-white flex flex-col md:flex-row gap-8 items-start md:items-center">
              <div className="flex-1">
                 <div className="flex items-center gap-2 mb-3">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-white/20">
                        Hệ thống khuyến nghị
                    </span>
                 </div>
                 <h2 className="text-2xl font-bold leading-snug mb-2">{advice.advice}</h2>
                 <p className="text-white/80 text-sm">Cập nhật dựa trên dữ liệu thời gian thực từ 22 trạm quan trắc.</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 w-full md:w-auto min-w-[300px]">
                 <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Hành động cần thiết</p>
                 <ul className="space-y-2">
                    {(advice.actions || []).map((action, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm font-medium">
                            <Umbrella size={14} className="text-white" />
                            {action}
                        </li>
                    ))}
                 </ul>
              </div>
           </div>
        </div>
      )}

      {/* 3. District Detail Grid */}
      <div>
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <MapPin className="text-blue-500" size={20} />
               Thời tiết 22 Quận Huyện
            </h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
               Dữ liệu OpenWeather
            </span>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((district, idx) => (
               <DistrictWeatherCard 
                 key={district.district || district.districtName || idx} 
                 data={district} 
                 icon={getWeatherIcon(district?.isRaining, district?.description || '')} 
                 onSelect={() => setSelectedDistrict(district)}
               />
            ))}
         </div>
      </div>

      {/* Modal chi tiết quận */}
      {selectedDistrict && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full relative">
            <button 
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-slate-100 text-slate-500"
              onClick={() => setSelectedDistrict(null)}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
            <DistrictDetailModal data={selectedDistrict} icon={getWeatherIcon(selectedDistrict?.isRaining, selectedDistrict?.description || '')} />
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for individual district
const DistrictWeatherCard: React.FC<{ data: any, icon: React.ReactNode, onSelect?: () => void }> = ({ data, icon, onSelect }) => {
    const districtKey = data.district || data.districtName || 'district';
    const forecast = data.forecast || [];
    const hasForecast = forecast.length > 0;
    const shortForecast = forecast.slice(0, 3);
    const maxPop = forecast.reduce((m, f) => Math.max(m, f.pop || 0), 0);
    // Transform forecast for chart
    const chartData = forecast.map(f => ({
        time: f.time,
        pop: Math.round(f.pop * 100) // Convert to percentage integer
    }));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900/95 backdrop-blur-sm text-white text-xs p-2.5 rounded-lg shadow-xl border border-slate-700/50 z-50 min-w-[100px]">
                    <p className="font-semibold text-slate-300 mb-1.5 border-b border-slate-700/50 pb-1">{label}</p>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 text-[10px] font-medium uppercase">Mưa</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]"></div>
                            <span className="font-bold text-sm text-blue-100">{payload[0].value}%</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div 
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group hover:-translate-y-1 cursor-pointer"
          onClick={onSelect}
        >
             {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="overflow-hidden">
                    <h4 className="font-bold text-slate-700 text-sm mb-0.5 truncate">{data.districtName || data.district || 'Không rõ quận'}</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400 capitalize truncate max-w-[120px]" title={typeof data.description === 'string' ? data.description : ''}>{typeof data.description === 'string' ? data.description : 'N/A'}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${maxPop>0.7?'bg-rose-100 text-rose-600':maxPop>0.4?'bg-amber-100 text-amber-600':'bg-emerald-100 text-emerald-600'}`}>
                        {(maxPop*100).toFixed(0)}% mưa
                      </span>
                    </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-blue-50">
                    {icon}
                </div>
            </div>

            {/* Main Stats */}
            <div className="flex items-end justify-between mb-5">
                <div>
                    <span className="text-3xl font-bold text-slate-800 tracking-tighter">{typeof data.temp === 'number' ? data.temp.toFixed(1) : '--'}°</span>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        <Droplets size={12} />
                        {typeof data.humidity === 'number' ? data.humidity : '--'}%
                    </div>
                </div>
            </div>

            {/* Sparkline for Rain Forecast */}
            <div className="h-24 w-full bg-slate-50/50 rounded-xl overflow-hidden relative border border-slate-100 group-hover:border-blue-100 transition-colors pt-5">
                <div className="absolute top-1.5 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition-colors">Dự báo 5h</p>
                </div>
                {hasForecast ? (
                    <div className="h-full w-full flex flex-col justify-between px-3 pb-3">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        {shortForecast.map((f, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold text-slate-700">{f.time || '--'}</span>
                            <span className="text-blue-600 font-bold">{Math.round((f.pop || 0)*100)}%</span>
                            <span className="text-slate-600">{typeof f.temp==='number'?`${f.temp}°`:'--'}</span>
                          </div>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={32}>
                        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`grad-${districtKey}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Tooltip 
                                content={<CustomTooltip />}
                                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="pop" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                fill={`url(#grad-${districtKey})`} 
                                activeDot={{ r: 3, strokeWidth: 1, stroke: '#fff', fill: '#2563eb' }}
                                animationDuration={800}
                            />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">
                        Không có dự báo
                    </div>
                )}
            </div>
        </div>
    );
}

const DistrictDetailModal: React.FC<{ data: any, icon: React.ReactNode }> = ({ data, icon }) => {
  const chartData = (data.forecast || []).map((f: any) => ({
    time: f.time || '',
    pop: Math.round((f.pop || 0) * 100),
    temp: f.temp,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
        <div>
          <p className="text-xs text-slate-400 uppercase font-semibold">{data.district}</p>
          <h3 className="text-xl font-bold text-slate-800">{data.districtName}</h3>
          <p className="text-sm text-slate-500">{typeof data.description === 'string' ? data.description : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Nhiệt độ" value={typeof data.temp === 'number' ? `${data.temp}°C` : '--'} />
        <Stat label="Cảm nhận" value={typeof data.feelsLike === 'number' ? `${data.feelsLike}°C` : '--'} />
        <Stat label="Độ ẩm" value={data.humidity ? `${data.humidity}%` : '--'} />
        <Stat label="Gió" value={typeof data.windSpeed === 'number' ? `${data.windSpeed} km/h` : '--'} />
      </div>

      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-slate-800">Dự báo 5h tới</h4>
          <p className="text-xs text-slate-500">Mưa (%) và nhiệt độ</p>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-detail-${data.district}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip content={({ active, payload, label }: any) => {
                if (active && payload && payload.length) {
                  const p = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow">
                      <p className="font-semibold text-slate-700 mb-1">{label}</p>
                      <p className="text-blue-600 font-semibold">Mưa: {p.pop}%</p>
                      <p className="text-slate-600">Nhiệt độ: {p.temp ?? '--'}°C</p>
                    </div>
                  );
                }
                return null;
              }} />
              <Area
                type="monotone"
                dataKey="pop"
                stroke="#2563eb"
                strokeWidth={2}
                fill={`url(#grad-detail-${data.district})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#2563eb' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-slate-500">Không có dữ liệu dự báo.</div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-white border border-slate-100 rounded-xl p-3">
    <p className="text-xs text-slate-400 uppercase font-semibold">{label}</p>
    <p className="text-lg font-bold text-slate-800 mt-1">{value}</p>
  </div>
);
