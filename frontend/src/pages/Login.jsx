import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, ShieldCheck, WifiOff } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = ({ setUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const navigate = useNavigate();

  // Change localhost to 127.0.0.1 for more reliability on Windows
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

  useEffect(() => {
    const checkServer = async () => {
        try {
            await axios.get(`${API_BASE}/`, { timeout: 2000 });
            setServerStatus('online');
        } catch (e) {
            setServerStatus('offline');
        }
    };
    checkServer();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create axios instance with timeout
      const instance = axios.create({
          baseURL: API_BASE,
          timeout: 10000 // 10 seconds timeout
      });

      const response = await instance.post('/auth/login', { username, password });
      const data = response.data;
      
      const loggedUser = {
        id: data.id,
        username: username,
        role: data.role,
        fullname: data.fullname,
        image: data.image,
        token: data.access_token
      };
      
      localStorage.setItem('user', JSON.stringify(loggedUser));
      localStorage.setItem('token', data.access_token);
      setUser(loggedUser);
      navigate(`/${loggedUser.role}/dashboard`);
    } catch (err) {
      console.error("Login Error:", err);
      let msg = "Login failed";
      
      if (err.code === 'ECONNABORTED') {
          msg = "Server timeout. Backend is too slow.";
      } else if (!err.response) {
          msg = "Server unreachable. Make sure backend is running on port 5000.";
      } else {
          msg = err.response.data?.message || "Invalid credentials";
      }
      
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden bg-slate-950 font-outfit">
      {/* Background Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-500/10 rounded-full blur-[120px]"></div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-cyan-500/20 rounded-[2rem] flex items-center justify-center mb-6 border border-cyan-500/30">
            <ShieldCheck className="text-cyan-400" size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Smart<span className="text-cyan-500 italic">Attend</span></h1>
          
          <div className="mt-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-green-500 animate-pulse' : serverStatus === 'offline' ? 'bg-red-500' : 'bg-slate-700'}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                System Status: {serverStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/10 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity</label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-cyan-500/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Security</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-white focus:border-cyan-500/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <button
              disabled={loading || serverStatus === 'offline'}
              className={`w-full py-5 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-3 transition-all ${
                  loading ? 'bg-slate-800' : serverStatus === 'offline' ? 'bg-red-900/40 text-red-300' : 'bg-cyan-600 hover:bg-cyan-500 shadow-xl shadow-cyan-500/20'
              }`}
            >
              {loading ? (
                <>Verifying Identity...</>
              ) : serverStatus === 'offline' ? (
                <><WifiOff size={20}/> Server Offline</>
              ) : (
                <>Enter Terminal <ArrowRight size={20} /></>
              )}
            </button>
          </form>
        </div>
        
        {serverStatus === 'offline' && (
            <p className="text-center mt-6 text-red-500/60 text-[10px] font-bold uppercase tracking-wider">
                Please start the backend (python backend/app.py) to login.
            </p>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
