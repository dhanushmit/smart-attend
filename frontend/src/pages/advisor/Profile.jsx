import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { User, Mail, BookOpen, LogOut } from 'lucide-react';

const AdvisorProfile = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="p-6 pb-24 min-h-screen bg-transparent">
      <header className="mb-10 pt-6">
        <h2 className="text-3xl font-bold font-outfit">Advisor Profile</h2>
        <p className="text-slate-400 text-sm">Assigned class access</p>
      </header>

      <div className="space-y-4">
        <GlassCard className="p-6 flex items-center gap-4">
          <div className="p-3 bg-white/5 rounded-2xl text-slate-400">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Username</p>
            <p className="font-bold text-sm">@{user.username || 'advisor'}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center gap-4 text-cyan-400 border-cyan-500/10" delay={0.1}>
          <div className="p-3 bg-cyan-500/10 rounded-2xl">
            <Mail size={20} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Full Name</p>
            <p className="font-bold text-sm">{user.fullname || 'Advisor'}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center gap-4 text-indigo-400 border-indigo-500/10" delay={0.2}>
          <div className="p-3 bg-indigo-500/10 rounded-2xl">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Role</p>
            <p className="font-bold text-sm">Class Advisor</p>
          </div>
        </GlassCard>

        <button
          onClick={handleLogout}
          className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-between hover:bg-red-500/20 transition-all group mt-6"
        >
          <div className="flex items-center gap-3 text-red-500">
            <LogOut size={18} />
            <span className="text-sm font-bold">Logout</span>
          </div>
        </button>
      </div>

      <Navbar role="advisor" />
    </div>
  );
};

export default AdvisorProfile;
