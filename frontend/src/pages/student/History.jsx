import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History as HistoryIcon, LogOut, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import axios from 'axios';
import GlassCard from '../../components/GlassCard';

const History = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const response = await axios.get(`${API_BASE}/attendance/history`, 
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setLogs(response.data);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-transparent p-6 relative flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 z-10">
        <button 
          onClick={() => window.location.href = '/student/dashboard'}
          className="w-12 h-12 glass-card rounded-2xl flex items-center justify-center text-slate-400"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold tracking-tight">HISTORY</h2>
            <div className="w-12 h-1 bg-cyan-500 rounded-full mt-1"></div>
        </div>
        <button onClick={handleLogout} className="w-12 h-12 glass-card rounded-2xl flex items-center justify-center text-red-500">
          <LogOut size={20} />
        </button>
      </header>

      {/* Stats Quick Look */}
      <div className="flex gap-4 mb-8">
         <GlassCard className="flex-1 p-5 py-6 flex flex-col items-center gap-1 border-white/5">
            <span className="text-2xl font-black text-white">{logs.length}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Logs</span>
         </GlassCard>
         <GlassCard className="flex-1 p-5 py-6 flex flex-col items-center gap-1 border-white/5">
            <span className="text-2xl font-black text-green-500">{logs.filter(l => l.status === 'present').length}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Present</span>
         </GlassCard>
      </div>

      {/* Logs List */}
      <div className="flex-1 flex flex-col pb-8">
        <div className="flex items-center gap-2 mb-6 px-2">
            <HistoryIcon size={18} className="text-cyan-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Activity Timeline</h3>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 opacity-50">
             <div className="p-6 bg-white/5 rounded-full"><Clock size={40} className="text-slate-600" /></div>
             <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No records found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group p-5 bg-white/[0.03] border border-white/5 rounded-[2rem] flex items-center justify-between hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center gap-5">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${log.status === 'present' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {log.status === 'present' ? <CheckCircle className="text-green-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
                   </div>
                   <div className="flex flex-col">
                      <span className="font-bold text-white text-lg tracking-tight">{new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-0.5">{log.time}</span>
                   </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${log.verified ? 'bg-cyan-500/10 text-cyan-500' : 'bg-amber-500/10 text-amber-500'}`}>
                   {log.verified ? 'VERIFIED' : 'PENDING'}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
