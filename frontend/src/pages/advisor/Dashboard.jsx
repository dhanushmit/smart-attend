import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Users, FileText, AlertTriangle, Search, Filter, Download as DownloadIcon, Bell, TrendingUp, MessageSquare, ChevronRight, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdvisorDashboard = () => {
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  const [stats, setStats] = useState({
    class_name: 'Loading...',
    total_students: 0,
    critical_alerts: 0,
    today_present: 0,
    today_absent: 0
  });
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/advisor/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/advisor/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchStudents();
    
    // Live update simulation (polling)
    const interval = setInterval(() => {
        fetchStudents();
    }, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  const filtered = students.filter(s => 
    s.fullname.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE}/advisor/reports/export?export=pdf`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Class_Report_${stats.class_name}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) {
        alert("Export failed");
    }
  };

  return (
    <div className="min-h-screen bg-transparent pb-32">
      <header className="px-8 pt-10 pb-6 flex items-center justify-between">
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Advisor Portal</h1>
          <p className="text-cyan-500 text-xs font-black tracking-[0.2em] mt-1 uppercase">{stats.class_name}</p>
        </motion.div>
        <Link to="/advisor/broadcast" className="relative p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-cyan-500/20 transition-all">
          <Bell className="text-slate-400" size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-950"></span>
        </Link>
      </header>

      {/* Hero Stats */}
      <div className="px-6 grid grid-cols-2 gap-4 mb-8">
        <GlassCard className="group relative" delay={0.1}>
            <div className="flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                        <Users size={20} />
                    </div>
                    <span className="text-green-400 text-[10px] font-bold">LIVE</span>
                </div>
                <span className="text-3xl font-bold">{stats.total_students}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Pupils in Node</span>
            </div>
        </GlassCard>

        <GlassCard className="group relative border-amber-500/20" delay={0.2}>
            <div className="flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400">
                        <AlertTriangle size={20} />
                    </div>
                </div>
                <span className="text-3xl font-bold text-red-500">{stats.critical_alerts}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Crit. Attendance</span>
            </div>
        </GlassCard>
      </div>

      <div className="px-6 mb-8 mt-2 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Locate student record..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/40 border border-white/5 rounded-3xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-cyan-500/30 transition-all text-white placeholder:text-slate-600 shadow-inner"
            />
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/advisor/manage-students')}
            className="w-14 h-14 bg-cyan-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500 transition-all"
          >
            <UserPlus size={22} />
          </motion.button>
        </div>

        <div className="flex gap-2">
            <Link to="/advisor/analytics" className="flex-1">
                <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3 border border-white/5 hover:bg-white/10 transition-all">
                    <TrendingUp size={16} className="text-purple-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Class Analytics</span>
                </div>
            </Link>
            <Link to="/advisor/broadcast" className="flex-1">
                <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3 border border-white/5 hover:bg-white/10 transition-all">
                    <MessageSquare size={16} className="text-indigo-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Global Msg</span>
                </div>
            </Link>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-lg font-bold tracking-tight font-outfit">Live Attendance</h3>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400 text-[10px] font-bold tracking-widest uppercase hover:bg-cyan-500/20 transition-all"
          >
            <DownloadIcon size={14} /> PDF Export
          </motion.button>
        </div>

        <div className="space-y-4">
            <AnimatePresence>
            {filtered.map((student, i) => (
            <motion.div 
                key={student.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.05 }}
                className="group flex items-center justify-between p-5 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all relative overflow-hidden"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {student.image ? (
                            <img src={student.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-lg font-bold text-cyan-400">{student.fullname.charAt(0)}</span>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors truncate">{student.fullname}</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{student.roll_no}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <span className={`text-[10px] uppercase font-black px-4 py-1.5 rounded-2xl tracking-tighter shadow-sm ${student.status === 'Present' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-500 border border-red-500/20'}`}>
                        {student.status}
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full ${student.attendance.replace('%','') < 75 ? 'bg-orange-500' : 'bg-green-500'}`} 
                                style={{ width: student.attendance }}
                            />
                        </div>
                        <span className={`text-[10px] font-bold ${student.attendance.replace('%','') < 75 ? 'text-orange-400' : 'text-slate-400'}`}>
                            {student.attendance}
                        </span>
                    </div>
                </div>
                <ChevronRight size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-800 group-hover:text-cyan-500 transition-all opacity-0 group-hover:opacity-100" />
            </motion.div>
            ))}
            </AnimatePresence>
        </div>
      </div>

      <Navbar role="advisor" />
    </div>
  );
};

export default AdvisorDashboard;
