import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Search, History, ArrowLeft, Download, Filter, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AttendanceHistory = () => {
    const navigate = useNavigate();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, verified: 0 });
    const [search, setSearch] = useState('');
    const [timeframe, setTimeframe] = useState('all'); // all, daily, weekly, monthly
  
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/admin/attendance/history?filter=${timeframe}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRecords(res.data.rows || []);
        setSummary(res.data.summary || { total: 0, present: 0, absent: 0, verified: 0 });
      } catch (err) {
        console.error(err);
      }
    };
  
    useEffect(() => {
        fetchHistory();
    }, [timeframe]);

    const handleExport = async (format) => {
        const token = localStorage.getItem('token');
        if (format === 'xlsx') {
            try {
                const response = await axios.get(`${API_BASE}/admin/attendance/history?filter=${timeframe}&export=xlsx`, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Attendance_Report_${timeframe}.xlsx`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            } catch (err) {
                alert("Export failed");
            }
        } else if (format === 'pdf') {
            try {
                const response = await axios.get(`${API_BASE}/admin/attendance/history?filter=${timeframe}&export=pdf`, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Attendance_Report_${timeframe}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            } catch (err) {
                alert("PDF export failed");
            }
        }
    };
  
    const filtered = records.filter(r => 
      r.student_name.toLowerCase().includes(search.toLowerCase()) || 
      r.roll_no.toLowerCase().includes(search.toLowerCase())
    );
  
    return (
      <div className="p-6 pb-24">
        <header className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/10 text-white">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h2 className="text-xl font-bold font-outfit text-white">Reports</h2>
                    <p className="text-xs text-slate-400">Timeframe: {timeframe.toUpperCase()}</p>
                </div>
            </div>
            <div className="flex gap-2 no-print">
                <button 
                    onClick={() => handleExport('xlsx')}
                    className="p-3 bg-green-500/20 text-green-500 rounded-2xl border border-green-500/30 hover:bg-green-500/30 transition-all font-bold text-[10px] flex items-center gap-2 uppercase tracking-tight"
                >
                    Excel
                </button>
                <button 
                    onClick={() => handleExport('pdf')}
                    className="p-3 bg-red-500/20 text-red-500 rounded-2xl border border-red-500/30 hover:bg-red-500/30 transition-all font-bold text-[10px] flex items-center gap-2 uppercase tracking-tight"
                >
                    PDF
                </button>
            </div>
        </header>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-print">
            {['all', 'daily', 'weekly', 'monthly'].map(t => (
                <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                        timeframe === t 
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-lg shadow-amber-500/20' 
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}
                >
                    {t}
                </button>
            ))}
        </div>
  
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter by name or roll..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:border-amber-500 outline-none transition-all text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="bg-white/5 p-3 rounded-2xl border border-white/10 text-slate-400">
            <Filter size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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
  
        <div className="space-y-3">
          {filtered.map((record, i) => (
            <GlassCard key={record.id} delay={i * 0.03} className="p-4 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <h4 className="font-bold text-sm text-white truncate">{record.student_name}</h4>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{record.roll_no}</span>
                    <span className="text-[10px] text-slate-400">•</span>
                    <span className="text-[10px] text-slate-400 font-medium">{record.date} {record.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            record.status === 'present' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                            {record.status}
                        </div>
                        <span className="text-[8px] text-slate-500 font-mono tracking-tighter">{record.location}</span>
                    </div>
                    {record.verified ? (
                        <CheckCircle size={14} className="text-cyan-500" />
                    ) : (
                        <XCircle size={14} className="text-slate-600" />
                    )}
              </div>
            </GlassCard>
          ))}
          {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                  <p className="text-sm italic">No records found matching your search</p>
              </div>
          )}
        </div>
  
        <Navbar role="admin" />
      </div>
    );
};

export default AttendanceHistory;
