import { useState } from 'react';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { User, Mail, Shield, LogOut, Save } from 'lucide-react';
import axios from 'axios';

const AdminProfile = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [form, setForm] = useState({
        fullname: user.fullname || '',
        email: user.email || '',
        password: ''
    });
    const [saving, setSaving] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${API_BASE}/auth/profile`, form, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({
                ...currentUser,
                ...res.data.user
            }));
            alert('Profile updated successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Profile update failed');
        } finally {
            setSaving(false);
        }
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

                <form onSubmit={handleUpdate} className="pt-8 space-y-3">
                    <GlassCard className="p-5 space-y-4">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Full Name</label>
                            <input
                                type="text"
                                value={form.fullname}
                                onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                                className="mt-2 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="mt-2 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">New Password</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Leave blank to keep same"
                                className="mt-2 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full p-4 bg-indigo-500/20 border border-indigo-500/20 rounded-3xl flex items-center justify-between hover:bg-indigo-500/30 transition-all group"
                        >
                            <div className="flex items-center gap-3 text-indigo-300">
                                <Save size={18} />
                                <span className="text-sm font-bold">{saving ? 'Updating...' : 'Update Profile'}</span>
                            </div>
                        </button>
                    </GlassCard>

                    <button 
                        onClick={handleLogout}
                        className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-between hover:bg-red-500/20 transition-all group mt-6"
                    >
                        <div className="flex items-center gap-3 text-red-500">
                            <LogOut size={18} />
                            <span className="text-sm font-bold">Terminate Session</span>
                        </div>
                    </button>
                </form>
            </div>

            <Navbar role="admin" />
        </div>
    );
};

export default AdminProfile;
