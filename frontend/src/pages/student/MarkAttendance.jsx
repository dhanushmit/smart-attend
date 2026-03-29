import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MapPin, CheckCircle2, AlertCircle, RefreshCw, LogOut, ArrowLeft, Shield, Zap } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import axios from 'axios';

const MarkAttendance = () => {
  const [step, setStep] = useState('camera'); // 'camera', 'success', 'error'
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

  useEffect(() => {
    if (step === 'camera') {
      startCamera();
    }
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setError("Camera access denied.");
      setStep('error');
    }
  };

  const waitForVideoFrame = async (video) => {
    if (!video) return false;
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 2500);
      const onReady = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', onReady);
          resolve(true);
        }
      };
      video.addEventListener('loadeddata', onReady);
    });
  };

  const captureAndVerify = async () => {
    setIsVerifying(true);
    setError('');
    
    try {
      const video = videoRef.current;
      const ready = await waitForVideoFrame(video);
      if (!ready) {
        setError('Camera frame not ready. Hold still and try again.');
        setStep('error');
        setIsVerifying(false);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (!canvas.width || !canvas.height) {
        setError('Camera image not available. Please retry.');
        setStep('error');
        setIsVerifying(false);
        return;
      }
      const ctx = canvas.getContext('2d');
      const burstImages = [];
      for (let i = 0; i < 4; i++) {
        ctx.drawImage(video, 0, 0);
        burstImages.push(canvas.toDataURL('image/jpeg', 0.9));
        if (i < 3) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      const token = localStorage.getItem('token'); // Send to backend for verification
      
      // Phase 1: Verify Face
      const response = await axios.post(`${API_BASE}/attendance/verify-face`, 
        { images: burstImages, image: burstImages[0] || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.verified) {
          // Proceed directly to mark without GPS as requested
          try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/attendance/mark`, 
              {}, 
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setStep('success');
            setIsVerifying(false);
          } catch (err) {
            console.error("Mark Error:", err);
            let userMsg = "Attendance marking failed.";
            
            if (err.response) {
              // The server responded with a specific error (e.g., 400, 403, 500)
              userMsg = err.response.data?.msg || err.response.data?.message || "Server Error (Please try again)";
            } else if (err.request) {
              // The request was made but no response was received (Server is OFFLINE)
              userMsg = "Server connection lost. Please ensure the backend (Flask) is running.";
            } else {
              userMsg = "System Error: " + err.message;
            }

            setError(userMsg);
            setStep('error');
            setIsVerifying(false);
          }
      } else {
        setError("Face match failed.");
        setStep('error');
        setIsVerifying(false);
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || "Verification failed.");
      setStep('error');
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col font-outfit">
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => window.history.back()} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Quick Verify</h2>
        <div className="w-12"></div>
      </header>
      
      <AnimatePresence mode="wait">
        {step === 'camera' && (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
                <div className="relative w-full max-w-sm aspect-square rounded-[40px] overflow-hidden border-4 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                  <div className="absolute inset-0 border-[40px] border-slate-950/40 pointer-events-none"></div>
                  
                  {isVerifying && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center">
                      <Zap size={48} className="text-cyan-400 animate-bounce mb-4" />
                      <span className="text-cyan-400 font-black text-xs uppercase tracking-[0.3em]">Burst Verifying...</span>
                    </div>
                  )}
                </div>
            </div>
            
            <div className="py-10">
                <button
                  onClick={captureAndVerify}
                  disabled={isVerifying}
                  className="w-full py-6 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl text-white font-black text-lg shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-4 active:scale-95 transition-all"
                >
                  {isVerifying ? "Verifying..." : <><Shield size={24} /> BURST SCAN</>}
                </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-32 h-32 bg-green-500/10 rounded-[40px] flex items-center justify-center border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.1)]">
              <CheckCircle2 size={64} className="text-green-500" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">SUCCESS!</h3>
            <p className="text-slate-400 font-medium">Attendance marked instantly.</p>
            <button
               onClick={() => window.location.href = '/student/dashboard'}
               className="mt-8 px-12 py-4 bg-white/5 rounded-3xl text-sm font-black text-white uppercase tracking-widest border border-white/10"
            >
              Done
            </button>

          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertCircle size={48} className="text-red-500" />
            </div>
            <h3 className="text-2xl font-bold text-white">{error}</h3>
            <button
              onClick={() => setStep('camera')}
              className="mt-6 px-10 py-5 bg-white/5 border border-white/10 rounded-3xl text-white font-black uppercase tracking-widest flex items-center gap-3"
            >
              <RefreshCw size={18} /> Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarkAttendance;
