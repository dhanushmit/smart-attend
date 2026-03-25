import { motion } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Camera, History, Bell, User, LogOut, ChevronRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const [stats, setStats] = useState({ present: 0, absent: 0, attendance_pct: 0 });
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [statsRes, alertsRes] = await Promise.all([
          axios.get(`${API_BASE}/attendance/stats`, { headers }),
          axios.get(`${API_BASE}/attendance/alerts/unread-count`, { headers })
        ]);
        setStats(statsRes.data);
        setAlertCount(alertsRes.data.count || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const actionCards = [
    { 
      label: 'Mark My Presence', 
      desc: 'Verify face identity', 
      icon: Camera, 
      color: 'text-cyan-400', 
      bg: 'bg-cyan-500/10',
      path: '/student/mark'
    },
    { 
      label: 'View Logs & History', 
      desc: loading ? 'Loading stats...' : `${stats.present} Days Present • ${stats.absent} Days Absent`, 
      icon: History, 
      color: 'text-indigo-400', 
      bg: 'bg-indigo-500/10',
      path: '/student/history'
    },
    { 
      label: 'Recent Alerts', 
      desc: alertCount > 0 ? `${alertCount} unread advisor notification${alertCount > 1 ? 's' : ''}` : 'Important notes from class advisor', 
      icon: Bell, 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/10',
      path: '/student/alerts',
      badge: alertCount
    },
  ];

  return (
    <div className="min-h-screen bg-transparent pb-32">
      {/* Header */}
      <header className="px-4 sm:px-8 pt-8 sm:pt-10 pb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 glass-card p-0.5 border-white/20">
            <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center overflow-hidden">
               {user.image ? (
                 <img src={user.image} alt="" className="w-full h-full object-cover" />
               ) : (
                 <User className="text-cyan-400" size={24} />
               )}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-outfit truncate">{user.fullname || 'Student'}</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Student Portal</p>
          </div>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={handleLogout}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all shadow-lg shadow-red-500/5 shrink-0"
        >
          <LogOut size={20} />
        </motion.button>
      </header>

      <div className="px-4 sm:px-6 space-y-5 sm:space-y-6">
        {/* Main Actions */}
        <div className="space-y-4">
            {actionCards.map((action, i) => (
            <GlassCard 
                key={i} 
                className="relative flex items-center gap-4 sm:gap-6 p-4 sm:p-6 group cursor-pointer border-white/5 active:scale-95 transition-all" 
                delay={i * 0.1}
                onClick={() => navigate(action.path)}
            >
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[1.25rem] sm:rounded-[1.5rem] ${action.bg} flex items-center justify-center shrink-0 group-hover:rotate-12 transition-transform duration-500`}>
                <action.icon className={action.color} size={24} />
                </div>
                <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{action.label}</h3>
                <p className="text-slate-500 text-[10px] mt-1 font-medium leading-relaxed">{action.desc}</p>
                </div>
                {!!action.badge && (
                  <span className="absolute right-10 top-4 inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-500/20">
                    {action.badge > 9 ? '9+' : action.badge}
                  </span>
                )}
                <ChevronRight className="text-slate-600 group-hover:translate-x-1 transition-transform" size={16} />
            </GlassCard>
            ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="p-5 border-green-500/10">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 text-center">Present</p>
            <p className="text-2xl font-black text-green-500 text-center">{stats.present}</p>
          </GlassCard>
          <GlassCard className="p-5 border-red-500/10">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 text-center">Absent</p>
            <p className="text-2xl font-black text-red-500 text-center">{stats.absent}</p>
          </GlassCard>
        </div>

        {/* Attendance Analytics Pie */}
        <GlassCard className="p-5 sm:p-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Performance</h4>
                </div>
                <div className="px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20 text-[8px] font-black text-cyan-400 uppercase tracking-widest">
                    Live Analytics
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="48" cy="48" r="42"
                            fill="transparent"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="10"
                        />
                        <motion.circle
                            cx="48" cy="48" r="42"
                            fill="transparent"
                            stroke="url(#gradient)"
                            strokeWidth="10"
                            strokeDasharray="264"
                            initial={{ strokeDashoffset: 264 }}
                            animate={{ strokeDashoffset: 264 - (264 * (stats.present / (stats.present + stats.absent || 1))) }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            strokeLinecap="round"
                        />
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#22d3ee" />
                                <stop offset="100%" stopColor="#6366f1" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black font-outfit">
                            {Math.round((stats.present / (stats.present + stats.absent || 1)) * 100)}%
                        </span>
                    </div>
                </div>
                <div className="flex-1 space-y-2">
                    <p className="text-[11px] leading-relaxed text-slate-400">
                        Your attendance is <span className="text-cyan-400 font-bold">{Math.round((stats.present / (stats.present + stats.absent || 1)) * 100)}%</span>.
                    </p>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${Math.max(8, Math.round(stats.attendance_pct || 0))}%` }}></div>
                    </div>
                    <p className="text-[9px] text-slate-500 italic">Target: 75% for exam eligibility</p>
                </div>
            </div>
        </GlassCard>
        
        {/* Status Bubble */}
        <motion.div 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="w-fit mx-auto px-6 py-3 rounded-full bg-green-500/10 border border-green-500/20 flex items-center gap-3"
        >
           <CheckCircle className="text-green-500" size={14} />
           <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Security Verified</span>
        </motion.div>
      </div>
      <Navbar role="student" />
    </div>
  );
};

export default StudentDashboard;
