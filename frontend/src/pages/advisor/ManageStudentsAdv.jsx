import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Search, Edit2, Trash2, ArrowLeft, X, Mail, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ManageStudentsAdv = () => {
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    roll_no: ''
  });

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/advisor/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!editingStudent) {
      alert("Advisors cannot add new students. Please ask admin to enroll.");
      return;
    }

    try {
      await axios.put(`${API_BASE}/advisor/students/${editingStudent.id}`, {
        fullname: formData.fullname,
        email: formData.email,
        roll_no: formData.roll_no,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowEditModal(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (err) {
      alert("Action failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this student from your class?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/advisor/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchStudents();
    } catch (err) {
      alert("Error removing student");
    }
  };

  const openEdit = (student) => {
    setEditingStudent(student);
    setFormData({
        fullname: student.fullname,
        email: student.email,
        roll_no: student.roll_no
    });
    setShowEditModal(true);
  };

  const filtered = students.filter(s => 
    s.fullname.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/10 text-slate-400">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold font-outfit">My Class Students</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-cyan-500">View & Update</p>
        </div>
      </header>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search in classroom..."
            className="w-full bg-slate-900/40 border border-white/10 rounded-3xl py-4 pl-12 pr-4 text-sm focus:border-cyan-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((student, i) => (
          <GlassCard key={student.id} delay={i * 0.05} className="flex items-center gap-4 p-5 rounded-[2.5rem] border-white/5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg overflow-hidden shrink-0">
                {student.image ? (
                    <img src={student.image} alt="" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-lg">{student.fullname.charAt(0)}</span>
                )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate group-hover:text-cyan-400 duration-300">{student.fullname}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{student.roll_no}</span>
                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                <span className={`text-[10px] font-bold ${student.attendance.replace('%','') < 75 ? 'text-red-400' : 'text-green-500'}`}>{student.attendance} Att.</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(student)} className="p-2.5 bg-white/5 rounded-2xl border border-white/5 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all">
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => handleDelete(student.id)}
                className="p-2.5 bg-white/5 rounded-2xl border border-white/5 hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      <AnimatePresence>
        {showEditModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              className="bg-slate-900 border border-white/10 rounded-[3rem] w-full max-w-md p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
              
              <button 
                onClick={() => setShowEditModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white bg-white/5 rounded-full"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-2xl font-bold mb-6 font-outfit">Edit Profile</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="Enrollment / Roll No"
                        required
                        className="w-full bg-slate-800/50 border border-white/5 rounded-3xl py-4 pl-12 pr-4 text-sm focus:border-cyan-500/50 outline-none"
                        value={formData.roll_no}
                        onChange={(e) => setFormData({...formData, roll_no: e.target.value})}
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Full Name"
                    required
                    className="w-full bg-slate-800/50 border border-white/5 rounded-3xl py-4 px-6 text-sm focus:border-cyan-500/50 outline-none"
                    value={formData.fullname}
                    onChange={(e) => setFormData({...formData, fullname: e.target.value})}
                  />
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors" size={16} />
                    <input 
                        type="email" 
                        placeholder="Email Address"
                        required
                        className="w-full bg-slate-800/50 border border-white/5 rounded-3xl py-4 pl-12 pr-4 text-sm focus:border-cyan-500/50 outline-none"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-6">
                    <button 
                        type="submit"
                        className="w-full py-4 bg-cyan-600 rounded-[2rem] font-bold shadow-xl shadow-cyan-500/20 hover:bg-cyan-500 hover:scale-[1.02] active:scale-[0.98] transition-all font-outfit text-lg"
                    >
                        Update Details
                    </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar role="advisor" />
    </div>
  );
};

export default ManageStudentsAdv;
