
import React, { useState, useRef } from 'react';
import { X, MapPin, Loader2, Camera, CheckCircle2, AlertCircle, Image as ImageIcon, Waves } from 'lucide-react';
import { api } from '../services/api';
import { FloodPoint, Report } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLat?: number;
  userLng?: number;
  onReportCreated?: (report: Report, point: FloodPoint) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, userLat, userLng, onReportCreated }) => {
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [waterLevel, setWaterLevel] = useState(20); // Default 20cm
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate a random reporter ID for this session if not existing
  const reporterId = useRef(`user_${Math.random().toString(36).substr(2, 9)}`).current;

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('idle');

    try {
      const formData = new FormData();
      formData.append('latitude', (userLat || 10.762622).toString());
      formData.append('longitude', (userLng || 106.660172).toString());
      formData.append('description', desc);
      formData.append('water_level', (waterLevel / 100).toString()); // Convert cm to m for API
      formData.append('reporterId', reporterId);
      
      if (file) {
        formData.append('images', file); // API v3.2 expects 'images'
      }

      await api.submitReport(formData);
      
      const now = new Date().toISOString();
      const lat = userLat || 10.762622;
      const lng = userLng || 106.660172;
      const waterLevelM = waterLevel / 100;

      // Cập nhật UI ngay lập tức nếu có callback
      if (onReportCreated) {
        const report: Report = {
          id: `local-${Date.now()}`,
          latitude: lat,
          longitude: lng,
          description: desc,
          locationName: desc || 'Báo cáo mới',
          timestamp: now,
          status: 'active',
          images: [],
          waterLevel: waterLevelM,
          riskScore: waterLevelM,
          riskLevel: waterLevel >= 80 ? 'Severe' : waterLevel >= 50 ? 'High' : 'Medium',
          address: 'Báo cáo thủ công',
          confidence: 'Đã xác thực',
          reportedAt: now,
          type: 'community',
        };

        const point: FloodPoint = {
          id: report.id,
          lat,
          lng,
          depth: waterLevel,
          locationName: report.locationName || 'Báo cáo mới',
          severity: report.riskLevel?.toLowerCase().includes('severe')
            ? 'severe'
            : report.riskLevel?.toLowerCase().includes('high')
            ? 'high'
            : 'medium',
          timestamp: now,
        };

        onReportCreated(report, point);
      }

      setStatus('success');
      setTimeout(() => {
        onClose();
        setDesc('');
        setFile(null);
        setWaterLevel(20);
        setStatus('idle');
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLevelColor = (cm: number) => {
    if (cm < 20) return 'text-blue-500';
    if (cm < 40) return 'text-amber-500';
    if (cm < 60) return 'text-orange-500';
    return 'text-rose-600';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300" 
        onClick={onClose}
      ></div>
      
      <div className="bg-white rounded-[2rem] w-full max-w-lg z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-white/20">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Báo cáo điểm ngập</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">ID: {reporterId}</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {status === 'success' ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in fade-in zoom-in-50 duration-500">
              <div className="relative">
                  <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-25"></div>
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 relative z-10">
                    <CheckCircle2 size={40} />
                  </div>
              </div>
              <div className="text-center">
                  <h3 className="text-2xl font-bold text-slate-800">Gửi thành công!</h3>
                  <p className="text-slate-500 mt-2 max-w-xs mx-auto">Cảm ơn đóng góp của bạn. Thông tin sẽ được cập nhật lên bản đồ sớm nhất.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Location Card */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-blue-600 animate-bounce">
                    <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Vị trí của bạn</label>
                  <p className="font-mono text-slate-700 font-bold text-lg tracking-tight mt-0.5">
                    {userLat ? `${userLat.toFixed(4)}, ${userLng?.toFixed(4)}` : 'Đang định vị...'}
                  </p>
                  <p className="text-xs text-blue-600/70 mt-1 font-medium">GPS Signal: Strong</p>
                </div>
              </div>

              {/* Water Level Slider */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <Waves size={16} className="text-blue-500" />
                          Mức độ ngập (ước lượng)
                      </label>
                      <span className={`text-xl font-black ${getLevelColor(waterLevel)}`}>{waterLevel} cm</span>
                  </div>
                  <input 
                      type="range" 
                      min="0" 
                      max="150" 
                      step="5"
                      value={waterLevel}
                      onChange={(e) => setWaterLevel(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mt-2">
                      <span>Mắt cá chân (10cm)</span>
                      <span>Đầu gối (50cm)</span>
                      <span>Yên xe (80cm+)</span>
                  </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mô tả chi tiết</label>
                <textarea
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ví dụ: Ngập qua bánh xe máy, kẹt xe nghiêm trọng..."
                  className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none h-24 transition-all placeholder:text-slate-400 text-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Hình ảnh hiện trường</label>
                <div 
                    className={`relative group cursor-pointer transition-all duration-200 ${dragActive ? 'scale-[1.02]' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className={`border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center transition-all ${
                        dragActive ? 'border-blue-500 bg-blue-50' : 
                        file ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 bg-slate-50 group-hover:border-blue-300 group-hover:bg-slate-100'
                    }`}>
                        {file ? (
                          <div className="text-center animate-in fade-in zoom-in-90">
                              <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-blue-200 flex items-center justify-center text-blue-600 mx-auto mb-2">
                                <ImageIcon size={20} />
                              </div>
                              <p className="text-blue-700 font-bold text-sm truncate max-w-[200px]">{file.name}</p>
                          </div>
                        ) : (
                          <div className="text-center pointer-events-none">
                              <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-2 group-hover:scale-110 transition-transform">
                                <Camera size={20} />
                              </div>
                              <p className="text-slate-600 font-medium text-xs">Tải ảnh lên</p>
                          </div>
                        )}
                    </div>
                </div>
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl text-sm border border-red-100 animate-in slide-in-from-top-2">
                    <AlertCircle size={18} />
                    <span className="font-medium">Có lỗi kết nối, vui lòng thử lại sau.</span>
                </div>
              )}

              <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-base hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gửi báo cáo ngay'}
                  </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
