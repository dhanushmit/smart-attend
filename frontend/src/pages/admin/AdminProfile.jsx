import { motion } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { User, Mail, Shield, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminProfile = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div className="p-6 pb-24 min-h-screen bg-transparent">
            <header className="mb-10 pt-6">
                <h2 className="text-3xl font-bold font-outfit">My Profile</h2>
                <p className="text-slate-400 text-sm">Control Center Access</p>
            </header>

            <div className="flex flex-col items-center mb-10">
                <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-4 shadow-2xl shadow-indigo-500/10">
                    <Shield className="text-indigo-400" size={40} />
                </div>
                <h3 className="text-xl font-bold">{user.fullname || 'Administrator'}</h3>
                <span className="px-4 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border border-indigo-500/30">
                    Master Admin
                </span>
            </div>

            <div className="space-y-4">
                <GlassCard className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl text-slate-400">
                        <User size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Username</p>
                        <p className="font-bold text-sm">@{user.username || 'admin'}</p>
                    </div>
                </GlassCard>

                <GlassCard className="p-6 flex items-center gap-4 text-indigo-400 border-indigo-500/10" delay={0.1}>
                    <div className="p-3 bg-indigo-500/10 rounded-2xl">
                        <Mail size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Secure Email</p>
                        <p className="font-bold text-sm">{user.email || 'admin@system.com'}</p>
                    </div>
                </GlassCard>

                <div className="pt-8 space-y-3">
                    <button className="w-full p-4 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between hover:bg-white/10 transition-all group">
                        <div className="flex items-center gap-3">
                            <Settings size={18} className="text-slate-500 group-hover:rotate-90 transition-transform duration-500" />
                            <span className="text-sm font-bold">System Settings</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase">Config</span>
                    </button>

                    <button 
                        onClick={handleLogout}
                        className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-between hover:bg-red-500/20 transition-all group mt-6"
                    >
                        <div className="flex items-center gap-3 text-red-500">
                            <LogOut size={18} />
                            <span className="text-sm font-bold">Terminate Session</span>
                        </div>
                    </button>
                </div>
            </div>

            <Navbar role="admin" />
        </div>
    );
};

export default AdminProfile;
