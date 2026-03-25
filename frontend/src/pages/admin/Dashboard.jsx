import { motion } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Shield, UserPlus, Database, PieChart, Activity, Settings, Users, History, TrendingUp } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  const [stats, setStats] = useState({
    total_students: 0,
    total_advisors: 0,
    total_attendance: 0,
    active_sessions: 124,
    api_load: 42
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, []);

  const actions = [
    { label: 'Manage Students', icon: Users, color: 'bg-cyan-500/20 text-cyan-400', path: '/admin/students' },
    { label: 'Manage Advisors', icon: Shield, color: 'bg-indigo-500/20 text-indigo-400', path: '/admin/advisors' },
    { label: 'Attendance History', icon: History, color: 'bg-amber-500/20 text-amber-500', path: '/admin/history' },
    { label: 'View Analytics', icon: TrendingUp, color: 'bg-purple-500/20 text-purple-400', path: '/admin/analytics' },
  ];

  return (
    <div className="p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-outfit">Admin Console 🛡️</h2>
          <p className="text-slate-400 text-sm">Real-time System Overview</p>
        </div>
        <button className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
          <Settings size={20} className="text-slate-400" />
        </button>
      </header>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {actions.map((action, i) => (
          <Link to={action.path} key={i}>
            <GlassCard className="flex flex-col items-center justify-center text-center gap-3 py-6 hover:border-cyan-500/50 transition-all group" delay={i * 0.1}>
              <div className={`p-4 rounded-2xl ${action.color} group-hover:scale-110 transition-all`}>
                <action.icon size={28} />
              </div>
              <span className="text-[13px] font-bold tracking-tight">{action.label}</span>
            </GlassCard>
          </Link>
        ))}
      </div>

      <GlassCard className="mb-8">
        <h3 className="font-bold mb-6 flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
          <Activity size={16} className="text-cyan-400" /> Live System Health
        </h3>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
              <span className="text-slate-500">Active Sessions</span>
              <span className="text-cyan-400">{stats.active_sessions}</span>
            </div>
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(stats.active_sessions / 200) * 100}%` }}
                className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              ></motion.div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
              <span className="text-slate-500">API Server Load</span>
              <span className="text-amber-500">{stats.api_load}%</span>
            </div>
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${stats.api_load}%` }}
                className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              ></motion.div>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Students</p>
            <p className="text-xl font-bold text-white">{stats.total_students}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Advisors</p>
            <p className="text-xl font-bold text-white">{stats.total_advisors}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-3xl border border-white/10 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Records</p>
            <p className="text-xl font-bold text-white">{stats.total_attendance}</p>
        </div>
      </div>

      <Navbar role="admin" />
    </div>
  );
};

export default AdminDashboard;
