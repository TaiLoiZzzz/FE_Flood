
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, Send, Bot, ChevronDown, RefreshCw, Sparkles, Trash2, Info, X } from 'lucide-react';
import { api } from '../services/api';
import { ChatMessage } from '../types';

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý AI giám sát ngập lụt. Tôi có thể giúp bạn tra cứu điểm ngập hoặc dự báo thời tiết.',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Session Stats
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [sessionStats, setSessionStats] = useState<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Create persistent session ID
  const [sessionId] = useState(`user-${Math.random().toString(36).substring(7)}`);

  const quickPrompts = [
    "Tình hình Quận 1?",
    "Dự báo 6h tới?",
    "Đường nào đang ngập?",
    "Thời tiết hiện tại?"
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Pass session_id to API
      const data = await api.sendMessage(text, sessionId);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Xin lỗi, tôi không thể trả lời lúc này.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Hệ thống đang bận, vui lòng thử lại sau.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
      if(!window.confirm("Bạn có chắc muốn xóa lịch sử chat này?")) return;
      try {
          await api.clearChatSession(sessionId);
          setMessages([{
            id: 'welcome-reset',
            role: 'assistant',
            content: 'Lịch sử trò chuyện đã được xóa. Tôi có thể giúp gì cho bạn?',
            timestamp: new Date().toISOString()
          }]);
      } catch (e) {
          console.error("Failed to clear chat", e);
      }
  }

  const checkSessionHealth = async () => {
      setShowSessionInfo(true);
      setSessionStats(null);
      try {
          const stats = await api.getChatSession(sessionId);
          setSessionStats(stats);
      } catch (e) {
          setSessionStats({ error: true });
      }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 bg-blue-600 text-white rounded-full shadow-[0_8px_30px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_40px_rgba(37,99,235,0.5)] transition-all transform hover:scale-110 active:scale-95 duration-300 group ${isOpen ? 'hidden' : 'flex'}`}
        aria-label="Open Chat"
      >
        <MessageSquare className="w-7 h-7 fill-current" />
        <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
        </span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-[380px] h-[650px] max-h-[calc(100vh-2rem)] bg-white rounded-3xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-md p-4 border-b border-slate-100 flex justify-between items-center absolute top-0 w-full z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">HCMC Assistant</h3>
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-[11px] text-slate-500 font-medium">Session Active</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
                 <button onClick={checkSessionHealth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors" title="Thông tin phiên">
                  <Info className="w-4 h-4" />
                </button>
                 <button onClick={handleClearHistory} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors" title="Xóa lịch sử">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <ChevronDown className="w-5 h-5" />
                </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto pt-20 pb-4 px-4 space-y-6 bg-slate-50/50 relative">
            
            {/* Session Info Overlay */}
            {showSessionInfo && (
                <div className="absolute top-20 left-4 right-4 z-20 bg-white shadow-xl rounded-2xl p-4 border border-slate-100 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-start mb-3">
                        <h4 className="text-sm font-bold text-slate-800">Thông tin phiên chat</h4>
                        <button onClick={() => setShowSessionInfo(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                    </div>
                    {sessionStats ? (
                        sessionStats.error ? (
                            <p className="text-xs text-red-500">Không tìm thấy thông tin session.</p>
                        ) : (
                            <div className="space-y-2 text-xs text-slate-600">
                                <div className="flex justify-between"><span>Session ID:</span> <span className="font-mono bg-slate-100 px-1 rounded">{sessionId.slice(0,8)}...</span></div>
                                <div className="flex justify-between"><span>Trạng thái:</span> <span className="text-emerald-500 font-bold">Active</span></div>
                                <div className="flex justify-between"><span>Messages:</span> <span>{messages.length}</span></div>
                                <div className="p-2 bg-blue-50 rounded text-blue-700 mt-2 text-[10px]">
                                    Kết nối ổn định với Gemini Pro API (Rate Limit: 30/min)
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="flex justify-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-blue-500" /></div>
                    )}
                </div>
            )}

            <div className="text-center text-[10px] font-medium text-slate-400 my-4 uppercase tracking-widest bg-slate-100/50 py-1 rounded-full w-max mx-auto px-3">
                Hôm nay, {new Date().toLocaleDateString('vi-VN')}
            </div>
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2 duration-300`}
              >
                {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 shadow-sm mt-auto mb-1">
                        <Sparkles size={14} className="text-blue-500" />
                    </div>
                )}
                <div
                  className={`max-w-[85%] p-3.5 text-[15px] leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-none'
                      : 'bg-white border border-slate-200/60 text-slate-700 rounded-2xl rounded-bl-none'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm as any]}
                      className="prose prose-sm text-slate-700 max-w-none prose-headings:text-slate-800 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:marker:text-slate-400"
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 shadow-sm mt-auto mb-1">
                    <Bot size={14} className="text-blue-500" />
                </div>
                <div className="bg-white border border-slate-200/60 p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1.5 items-center w-16">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100">
             {/* Quick Prompts */}
            {!isLoading && messages.length < 5 && (
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                    {quickPrompts.map((prompt, i) => (
                        <button 
                            key={i}
                            onClick={() => handleSend(prompt)}
                            className="whitespace-nowrap px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Hỏi về tình hình ngập..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800 px-2 h-9 placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-blue-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center mt-2.5 flex items-center justify-center gap-1.5">
                 <Info size={10} className="text-slate-300" />
                 <p className="text-[10px] text-slate-300 font-medium">Powered by Gemini Pro • HCMC FloodWatch</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
