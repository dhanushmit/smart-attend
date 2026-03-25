import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { TrendingUp, ArrowLeft, Users, Calendar, BarChart3, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Analytics = () => {
    const navigate = useNavigate();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [stats, setStats] = useState({
        present_rate: 85,
        avg_verified: 92,
        daily: [65, 80, 75, 90, 85, 95, 80],
        weekly_trend: 'up'
    });
  
    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE}/admin/analytics`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (err) {
                console.error("Analytics fetch failed", err);
            }
        };
        fetchAnalytics();
    }, []);
  
    return (
      <div className="p-6 pb-24">
        <header className="mb-6 flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/10">
                <ArrowLeft size={18} />
            </button>
            <div>
                <h2 className="text-xl font-bold font-outfit text-purple-400">System Analytics</h2>
                <p className="text-xs text-slate-400">Data-driven Insights</p>
            </div>
        </header>

        <div className="grid grid-cols-2 gap-4 mb-6">
            <GlassCard className="p-4 border-l-4 border-cyan-500">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Present Rate</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{stats.present_rate}%</span>
                    <span className="text-[10px] text-green-400 font-bold">{stats.weekly_trend === 'up' ? 'Rising' : 'Stable'}</span>
                </div>
            </GlassCard>
            <GlassCard className="p-4 border-l-4 border-purple-500">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Face Verified</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{stats.avg_verified}%</span>
                    <span className="text-[10px] text-green-400 font-bold">Live</span>
                </div>
            </GlassCard>
        </div>

        <GlassCard className="mb-6 p-6">
            <h3 className="font-bold mb-6 text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <BarChart3 size={16} className="text-purple-400" /> Daily Attendance Trend
            </h3>
            <div className="flex items-end justify-between h-32 gap-2">
                {stats.daily.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="relative w-full">
                            <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: `${val}%` }}
                                className="w-full bg-gradient-to-t from-purple-600 to-indigo-400 rounded-t-lg group-hover:from-cyan-500 transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                            />
                        </div>
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Day {i+1}</span>
                    </div>
                ))}
            </div>
        </GlassCard>

        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-2">Recent Performance</h3>
            </div>
            
            <GlassCard className="p-4 flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-2xl">
                    <TrendingUp className="text-green-500" size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold">Peak Engagement</h4>
                    <p className="text-[10px] text-slate-400">Activity peaked at 9:15 AM today</p>
                </div>
                <span className="text-[10px] font-bold text-green-400">+18%</span>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-2xl">
                    <Users className="text-amber-500" size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold">New Registrations</h4>
                    <p className="text-[10px] text-slate-400">{stats.new_students} students registered in system</p>
                </div>
                <span className="text-[10px] font-bold text-amber-500">{stats.new_students}</span>
            </GlassCard>
        </section>
  
        <Navbar role="admin" />
      </div>
    );
};

export default Analytics;
