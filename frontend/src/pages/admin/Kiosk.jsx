import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, Zap, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import axios from 'axios';

const AdminKiosk = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

  const [step, setStep] = useState('camera'); // camera | success | error
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (step !== 'camera') return;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError('Camera access denied');
        setStep('error');
      }
    };
    start();
  }, [step]);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream?.getTracks) stream.getTracks().forEach(t => t.stop());
  };

  const burstCapture = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    const frames = [];
    for (let i = 0; i < 4; i++) {
      ctx.drawImage(video, 0, 0);
      frames.push(canvas.toDataURL('image/jpeg', 0.9));
      if (i < 3) await new Promise(r => setTimeout(r, 250));
    }
    return frames;
  };

  const scanAndMark = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const frames = await burstCapture();
      if (!frames || frames.length === 0) {
        setError('Camera frame not ready. Try again.');
        setStep('error');
        setBusy(false);
        return;
      }

      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/attendance/identify`, {
        images: frames,
        mark: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResult(res.data);
      stopCamera();
      setStep('success');
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Scan failed';
      setResult(err.response?.data || null);
      setError(msg);
      stopCamera();
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 pb-28 font-outfit">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-sm sm:text-lg font-black text-white uppercase tracking-[0.25em]">Kiosk Scan</h2>
        <div className="w-11" />
      </header>

      <AnimatePresence mode="wait">
        {step === 'camera' && (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <GlassCard className="p-4">
              <div className="relative w-full max-w-sm mx-auto aspect-square rounded-[40px] overflow-hidden border-4 border-cyan-500/30">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute inset-0 border-[40px] border-slate-950/40 pointer-events-none" />
                {busy && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Zap size={48} className="text-cyan-400 animate-bounce mb-4" />
                    <span className="text-cyan-400 font-black text-xs uppercase tracking-[0.3em]">Identifying...</span>
                  </div>
                )}
              </div>
            </GlassCard>

            <button
              onClick={scanAndMark}
              disabled={busy}
              className="w-full py-6 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl text-white font-black text-lg shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-4 active:scale-95 transition-all"
            >
              <Shield size={24} />
              {busy ? 'Scanning...' : 'SCAN & MARK'}
            </button>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center text-center gap-5">
            <div className="w-28 h-28 bg-green-500/10 rounded-[40px] flex items-center justify-center border border-green-500/20">
              <CheckCircle2 size={56} className="text-green-500" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Marked</h3>
            {result?.student && (
              <GlassCard className="w-full max-w-sm p-4 text-left">
                <p className="text-[10px] uppercase tracking-[0.25em] font-black text-slate-400">Student</p>
                <p className="text-lg font-bold text-white mt-1">{result.student.fullname}</p>
                <p className="text-xs text-slate-400 mt-1">{result.student.roll_no} {result.student.class_name ? `• ${result.student.class_name}` : ''}</p>
                <p className="text-xs text-slate-500 mt-2">Distance: {result.distance} / Threshold: {result.threshold}</p>
                <p className="text-xs text-slate-500 mt-1">{result.msg}</p>
              </GlassCard>
            )}
            <button
              onClick={() => { setStep('camera'); setResult(null); }}
              className="mt-2 px-10 py-4 bg-white/5 border border-white/10 rounded-3xl text-white font-black uppercase tracking-widest"
            >
              Next Scan
            </button>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center gap-5">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertCircle size={48} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white">{error}</h3>
            {result?.debug && (
              <GlassCard className="w-full max-w-sm p-4 text-left">
                <p className="text-[10px] uppercase tracking-[0.25em] font-black text-amber-400 mb-2">Debug</p>
                <p className="text-xs text-slate-300">Frames: {result.debug.frames_used ?? 0}/{result.debug.frames_requested ?? 0}</p>
                {Array.isArray(result.debug.frame_distances) && (
                  <p className="text-xs text-slate-300 mt-1 break-all">Scores: {result.debug.frame_distances.map((v, i) => `#${i + 1}:${v ?? 'x'}`).join('  ')}</p>
                )}
              </GlassCard>
            )}
            <button
              onClick={() => { setStep('camera'); setResult(null); }}
              className="mt-1 px-10 py-5 bg-white/5 border border-white/10 rounded-3xl text-white font-black uppercase tracking-widest flex items-center gap-3"
            >
              <RefreshCw size={18} />
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar role="admin" />
    </div>
  );
};

export default AdminKiosk;

