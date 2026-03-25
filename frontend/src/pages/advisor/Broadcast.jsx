import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { ArrowLeft, Send, Bell, Info, AlertOctagon, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Broadcast = () => {
    const navigate = useNavigate();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [message, setMessage] = useState('');
    const [urgent, setUrgent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [studentCount, setStudentCount] = useState(0);

    useEffect(() => {
      const fetchStudentCount = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_BASE}/advisor/dashboard`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setStudentCount(res.data?.total_students || 0);
        } catch (err) {
          setStudentCount(0);
        }
      };
      fetchStudentCount();
    }, [API_BASE]);
  
    const handleSend = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_BASE}/advisor/announcements`, { message, urgent }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess(true);
        setMessage('');
        setTimeout(() => setSuccess(false), 3000);
      } catch (err) {
        setError(err.response?.data?.msg || 'Notification send failed. Please check class allocation and try again.');
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="p-4 sm:p-6 pb-24">
        <header className="mb-6 flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/10">
                <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold font-outfit text-indigo-400">Class Broadcast</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Advisor Notifications</p>
            </div>
        </header>

        <section className="space-y-6">
            <GlassCard className="p-1 relative overflow-hidden bg-white/5 border-white/5 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent">
                <div className="p-5 sm:p-8">
                    <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                         <div className="p-3 sm:p-4 bg-indigo-500/20 rounded-3xl text-indigo-400 shrink-0">
                            <Bell className="animate-pulse" size={32} />
                         </div>
                         <div className="min-w-0">
                            <h3 className="text-lg font-bold">New Message</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              {studentCount > 0 ? `Notify ${studentCount} assigned students` : 'Send to your allocated class'}
                            </p>
                         </div>
                    </div>
                    
                    <form onSubmit={handleSend} className="space-y-6">
                        <textarea 
                            required
                            placeholder="Type your announcement here..."
                            rows={6}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full bg-slate-900 border border-white/5 rounded-[2rem] p-6 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                        />
                        
                        <div className="flex items-center justify-between p-2 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-3 px-2">
                                <AlertOctagon size={18} className={urgent ? 'text-red-500' : 'text-slate-600'} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${urgent ? 'text-red-400' : 'text-slate-500'}`}>Urgent Alert</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setUrgent(!urgent)}
                                className={`w-12 h-6 rounded-full transition-all relative ${urgent ? 'bg-red-500' : 'bg-slate-800'}`}
                            >
                                <motion.div 
                                    animate={{ x: urgent ? 24 : 4 }}
                                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
                                />
                            </button>
                        </div>
                        
                        <button 
                            disabled={loading || !message}
                            className="w-full py-5 bg-indigo-600 rounded-[2rem] font-bold text-white shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send size={20} />
                                    <span className="font-outfit text-lg tracking-wide">Broadcast Message</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </GlassCard>

            <AnimatePresence>
                {success && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="p-4 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center gap-3 text-green-400"
                    >
                        <CheckCircle2 size={24} />
                        <span className="text-sm font-bold">Successfully sent to everyone in the class node.</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        className="p-4 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300"
                    >
                        <X size={20} className="shrink-0 mt-0.5" />
                        <span className="text-sm font-medium leading-relaxed">{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-4">Template Guides</h4>
                <div className="grid grid-cols-2 gap-3">
                    <div 
                        onClick={() => setMessage("Reminder: Complete your face scans tomorrow!")}
                        className="p-4 bg-white/5 border border-white/5 rounded-3xl cursor-pointer hover:bg-white/10 transition-all"
                    >
                        <Info size={16} className="text-cyan-400 mb-2" />
                        <p className="text-[10px] font-bold text-slate-400">Bio Scan Remind</p>
                    </div>
                    <div 
                        onClick={() => {setMessage("Emergency: Holiday announced for tomorrow!"); setUrgent(true);}}
                        className="p-4 bg-white/5 border border-white/5 rounded-3xl cursor-pointer hover:bg-white/10 transition-all"
                    >
                        <AlertOctagon size={16} className="text-red-400 mb-2" />
                        <p className="text-[10px] font-bold text-slate-400">Holiday Notice</p>
                    </div>
                </div>
            </div>
        </section>
  
        <Navbar role="advisor" />
      </div>
    );
};

export default Broadcast;
