import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { ArrowLeft, BarChart3, PieChart, Calendar, Search, Download, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AttendanceAnalyticsAdv = () => {
    const navigate = useNavigate();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [stats, setStats] = useState({
        monthly_avg: 0,
        weekly_change: '+0%',
        distribution: [],
        top_performer: 'N/A',
        top_pct: 0,
        month_reports: [],
        student_matrix: []
    });
    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, verified: 0 });
    const [search, setSearch] = useState('');
    const [timeframe, setTimeframe] = useState('all');
    const [className, setClassName] = useState('');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };
                const [analyticsRes, reportsRes] = await Promise.all([
                    axios.get(`${API_BASE}/advisor/analytics`, { headers }),
                    axios.get(`${API_BASE}/advisor/reports/history?filter=${timeframe}`, { headers })
                ]);
                setStats(analyticsRes.data);
                setRecords(reportsRes.data.rows || []);
                setSummary(reportsRes.data.summary || { total: 0, present: 0, absent: 0, verified: 0 });
                setClassName(reportsRes.data.class_name || '');
            } catch (err) {
                console.error("Advisor analytics fetch failed", err);
            }
        };
        fetchAnalytics();
    }, [API_BASE, timeframe]);

    const handleExport = async (format) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/advisor/reports/export?filter=${timeframe}&export=${format}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const mime = format === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const url = window.URL.createObjectURL(new Blob([response.data], { type: mime }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Advisor_${timeframe}_report.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert(`${format.toUpperCase()} export failed`);
        }
    };

    const filteredRecords = records.filter((record) =>
        record.student_name.toLowerCase().includes(search.toLowerCase()) ||
        record.roll_no.toLowerCase().includes(search.toLowerCase())
    );
  
    return (
      <div className="p-4 sm:p-6 pb-24">
        <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/10 text-slate-400">
                <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
                <h2 className="text-xl font-bold font-outfit text-cyan-400">Class Analytics</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    {className ? `${className} • ` : ''}Timeframe: {timeframe.toUpperCase()}
                </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleExport('xlsx')}
              className="flex-1 sm:flex-none px-4 py-3 bg-green-500/20 text-green-400 rounded-2xl border border-green-500/30 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex-1 sm:flex-none px-4 py-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Download size={14} />
              PDF
            </button>
          </div>
        </header>

        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {['all', 'daily', 'weekly', 'monthly'].map((item) => (
            <button
              key={item}
              onClick={() => setTimeframe(item)}
              className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
                timeframe === item
                  ? 'bg-cyan-400 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or roll..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:border-cyan-400 outline-none transition-all text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <GlassCard className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Total</p>
            <p className="text-xl font-bold text-white">{summary.total}</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Present</p>
            <p className="text-xl font-bold text-green-400">{summary.present}</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Absent</p>
            <p className="text-xl font-bold text-red-400">{summary.absent}</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Verified</p>
            <p className="text-xl font-bold text-cyan-400">{summary.verified}</p>
          </GlassCard>
        </div>

        <div className="space-y-3 mb-6">
          {filteredRecords.slice(0, 8).map((record, index) => (
            <GlassCard key={record.id} delay={index * 0.03} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-white truncate">{record.student_name}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                  <span className="uppercase font-bold tracking-widest text-slate-500">{record.roll_no}</span>
                  <span>•</span>
                  <span>{record.date} {record.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    record.status === 'present' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {record.status}
                  </div>
                </div>
                {record.verified ? (
                  <CheckCircle size={14} className="text-cyan-500" />
                ) : (
                  <XCircle size={14} className="text-slate-600" />
                )}
              </div>
            </GlassCard>
          ))}
          {filteredRecords.length === 0 && (
            <GlassCard className="p-6 text-center text-sm text-slate-500">
              No report rows found for this timeframe.
            </GlassCard>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
            <GlassCard className="p-5 border-l-4 border-cyan-500">
                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Monthly Avg</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{stats.monthly_avg}%</span>
                    <span className="text-[10px] text-green-400 font-bold">{stats.weekly_change}</span>
                </div>
            </GlassCard>
            <GlassCard className="p-5 border-l-4 border-purple-500">
                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Top Performer</p>
                <div className="flex flex-col">
                    <span className="text-sm font-bold truncate">{stats.top_performer}</span>
                    <span className="text-[10px] text-purple-400 font-bold">{stats.top_pct}% record</span>
                </div>
            </GlassCard>
        </div>

        <GlassCard className="mb-6 p-5 sm:p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl -mr-16 -mt-16 rounded-full"></div>
            <h3 className="font-bold mb-8 text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-400" /> Weekly Distribution
            </h3>
            <div className="flex items-end justify-between h-40 gap-3">
                {stats.distribution.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3">
                        <div className="w-full relative group">
                            <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: `${day.val}%` }}
                                className="w-full bg-gradient-to-t from-cyan-600 to-blue-400 rounded-t-2xl group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-300"
                            />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                                {day.val}%
                            </div>
                        </div>
                        <span className="text-[9px] text-slate-600 font-black uppercase tracking-tighter">{day.label}</span>
                    </div>
                ))}
            </div>
        </GlassCard>

        <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 ml-2 mb-2">Detailed Breakdowns</h4>
            
            <GlassCard className="p-5 border-white/5">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-red-500/10 rounded-2xl text-red-400">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold">Month-wise Report</h4>
                        <p className="text-[10px] text-slate-500">Monthly attendance summary</p>
                    </div>
                </div>
                <div className="space-y-3">
                    {stats.month_reports.length > 0 ? stats.month_reports.map((report) => (
                        <div key={report.month} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                            <div>
                                <p className="text-sm font-bold text-white">{report.month}</p>
                                <p className="text-[10px] text-slate-500">{report.sessions} sessions</p>
                            </div>
                            <span className="text-sm font-bold text-red-400">{report.present_rate}%</span>
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-500">No month-wise report available yet.</p>
                    )}
                </div>
            </GlassCard>

            <GlassCard className="p-5 border-white/5">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400">
                        <PieChart size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold">Student-wise Matrix</h4>
                        <p className="text-[10px] text-slate-500">Compare individual progress</p>
                    </div>
                </div>
                <div className="space-y-3">
                    {stats.student_matrix.length > 0 ? stats.student_matrix.map((student, index) => (
                        <div key={`${student.roll_no}-${index}`} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                            <div>
                                <p className="text-sm font-bold text-white">{student.student_name}</p>
                                <p className="text-[10px] text-slate-500">{student.roll_no} | P: {student.present} | A: {student.absent}</p>
                            </div>
                            <span className="text-sm font-bold text-cyan-400">{student.attendance_pct}%</span>
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-500">No student matrix available yet.</p>
                    )}
                </div>
            </GlassCard>
        </section>

        <Navbar role="advisor" />
      </div>
    );
};

export default AttendanceAnalyticsAdv;
