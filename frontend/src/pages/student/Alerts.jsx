import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Bell, ArrowLeft, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Alerts = () => {
    const navigate = useNavigate();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/attendance/alerts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAlerts(res.data);
            await axios.post(`${API_BASE}/attendance/alerts/mark-read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const getIcon = (type) => {
        switch(type) {
            case 'alert': return <AlertTriangle className="text-red-400" size={20} />;
            case 'warning': return <AlertTriangle className="text-amber-400" size={20} />;
            case 'success': return <ShieldCheck className="text-green-400" size={20} />;
            default: return <Info className="text-cyan-400" size={20} />;
        }
    };

    return (
        <div className="p-6 pb-24 min-h-screen bg-transparent">
            <header className="mb-8 flex items-center gap-4 pt-6">
                <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/10">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h2 className="text-xl font-bold font-outfit">Recent Alerts</h2>
                    <p className="text-xs text-slate-400">Notifications from Advisors</p>
                </div>
            </header>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-500 italic text-sm">Fetching broadcasts...</div>
                ) : alerts.map((alert, i) => (
                    <GlassCard key={alert.id} delay={i * 0.1} className="p-5 flex items-start gap-4 border-l-4 border-cyan-500">
                        <div className="p-3 bg-white/5 rounded-2xl shrink-0">
                            {getIcon(alert.type)}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium leading-relaxed text-slate-200">{alert.message}</p>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-3 block">{alert.date}</span>
                        </div>
                    </GlassCard>
                ))}
                {!loading && alerts.length === 0 && (
                    <div className="text-center py-12 text-slate-500 italic text-sm">No new alerts found</div>
                )}
            </div>

            <Navbar role="student" />
        </div>
    );
};

export default Alerts;
