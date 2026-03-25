import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Search, UserPlus, Edit2, Trash2, ArrowLeft, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ManageStudents = () => {
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null);
  const [capturing, setCapturing] = useState(false);
  
  const [newStudent, setNewStudent] = useState({
    username: '',
    fullname: '',
    email: '',
    roll_no: '',
    password: 'password123',
    class_id: ''
  });

  const [editForm, setEditForm] = useState({
    username: '',
    fullname: '',
    roll_no: '',
    email: '',
    password: '',
    class_id: ''
  });

  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [preview, setPreview] = useState(null);

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/admin/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClasses(res.data);
    } catch (err) {
      console.error("Class fetch error:", err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  // Utility to convert base64 to File/Blob
  const dataURLtoBlob = (dataurl) => {
    try {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    } catch (e) {
        return null;
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem('token');

    if (capturedImages.length === 0) {
      alert("Please capture face frames before saving student.");
      setSaving(false);
      return;
    }
    
    // Switch to JSON Instead of FormData for Multiple Images Protocol
    const payload = {
        ...newStudent,
        images: capturedImages
    };

    try {
      await axios.post(`${API_BASE}/admin/students`, payload, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
      });
      setShowAddModal(false);
      setNewStudent({ username: '', fullname: '', email: '', roll_no: '', password: 'password123', class_id: '' });
      setSelectedFile(null);
      setCapturedImages([]);
      setPreview(null);
      fetchStudents();
      alert("Student enrolled with multi-biometric profile successfully!");
    } catch (err) {
      console.error("Save Error:", err.response?.data);
      alert(err.response?.data?.msg || "Error adding student. Check if username exists.");
    } finally {
        setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    Object.keys(editForm).forEach(key => {
        if (editForm[key]) formData.append(key, editForm[key]);
    });
    
    if (selectedFile) {
        const blob = typeof selectedFile === 'string' ? dataURLtoBlob(selectedFile) : selectedFile;
        if (blob) formData.append('image', blob, 'update.jpg');
    }

    try {
      await axios.put(`${API_BASE}/admin/students/${activeStudent.id}`, formData, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
        }
      });
      setShowEditModal(false);
      setSelectedFile(null);
      setPreview(null);
      fetchStudents();
      alert("Update successful!");
    } catch (err) {
      console.error("Update Error:", err.response?.data);
      alert(err.response?.data?.msg || "Error updating student");
    } finally {
        setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/admin/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchStudents();
    } catch (err) {
      alert("Error deleting student");
    }
  };

  const startCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        const video = document.getElementById('admin-cam');
        if (video) video.srcObject = stream;
    } catch (err) {
        alert("Could not access camera");
    }
  };

  const captureFace = async () => {
    setCapturing(true);
    const video = document.getElementById('admin-cam');
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const image = canvas.toDataURL('image/jpeg');

    try {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API_BASE}/admin/students/${activeStudent.id}/face`, { image }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        alert(res.data.msg);
        setShowFaceModal(false);
        fetchStudents();
    } catch (err) {
        alert(err.response?.data?.msg || "Face update failed");
    } finally {
        setCapturing(false);
        const stream = video.srcObject;
        stream?.getTracks().forEach(t => t.stop());
    }
  };

  const filtered = students.filter(s => 
    s.fullname.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24 relative overflow-hidden font-outfit">
      {/* Ambient Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="mb-8 flex items-center gap-4 relative z-10">
        <button onClick={() => navigate(-1)} className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <div>
          <h2 className="text-2xl font-black font-outfit tracking-tight text-white">Student Management</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Centralized Biometric Database</p>
        </div>
      </header>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search students..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:border-cyan-500/50 outline-none transition-all text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
              setShowAddModal(true);
              setPreview(null);
              setSelectedFile(null);
          }}
          className="bg-cyan-600 p-3 rounded-2xl flex items-center justify-center hover:bg-cyan-500 transition-all font-bold text-white shadow-lg shadow-cyan-600/20"
        >
          <UserPlus size={20} />
        </button>
      </div>

      <div className="space-y-4">
        {filtered.map((student, i) => (
          <GlassCard key={student.id} delay={i * 0.05} className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg overflow-hidden relative group">
                {student.image ? (
                    <img src={student.image} alt="" className="w-full h-full object-cover" />
                ) : (
                    student.fullname.charAt(0)
                )}
                <div 
                    onClick={() => { setActiveStudent(student); setShowFaceModal(true); setTimeout(startCamera, 100); }}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                    <Camera size={16} className="text-cyan-400" />
                </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate text-white">{student.fullname}</h4>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{student.roll_no} • {student.username}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setActiveStudent(student); setShowFaceModal(true); setTimeout(startCamera, 100); }}
                className="p-2 bg-white/5 rounded-xl border border-white/10 hover:text-cyan-400 transition-all text-slate-400" title="Face Enroll"
              >
                <Camera size={14} />
              </button>
              <button 
                onClick={() => { 
                    setActiveStudent(student); 
                    setEditForm({ 
                        username: student.username,
                        fullname: student.fullname, 
                        roll_no: student.roll_no, 
                        email: student.email || '',
                        password: '',
                        class_id: student.class_id || ''
                    }); 
                    setPreview(student.image);
                    setSelectedFile(null);
                    setShowEditModal(true); 
                }}
                className="p-2 bg-white/5 rounded-xl border border-white/10 hover:text-indigo-400 transition-all text-slate-400"
              >
                <Edit2 size={14} />
              </button>
              <button 
                onClick={() => handleDelete(student.id)}
                className="p-2 bg-white/5 rounded-xl border border-white/10 hover:text-red-400 transition-all text-slate-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"><X size={20} /></button>
              <h3 className="text-xl font-bold mb-6 font-outfit text-white">New Student</h3>
              <form onSubmit={handleAdd} className="space-y-4 text-white">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Username</label>
                  <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={newStudent.username} onChange={(e) => setNewStudent({...newStudent, username: e.target.value})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Full Name</label>
                  <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={newStudent.fullname} onChange={(e) => setNewStudent({...newStudent, fullname: e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Roll No</label>
                    <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={newStudent.roll_no} onChange={(e) => setNewStudent({...newStudent, roll_no: e.target.value})}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Password</label>
                    <input type="password" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={newStudent.password} onChange={(e) => setNewStudent({...newStudent, password: e.target.value})}/>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Assign Class</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none"
                    value={newStudent.class_id}
                    onChange={(e) => setNewStudent({...newStudent, class_id: e.target.value})}
                  >
                    <option value="">No class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}{cls.advisor_name ? ` - ${cls.advisor_name}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Verification Face Data</label>
                  <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="relative w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10">
                      {preview ? <img src={preview} alt="Captured" className="w-full h-full object-cover" /> : <Camera className="text-slate-600" size={24} />}
                    </div>
                    <div className="flex flex-col flex-1">
                      <button 
                        type="button"
                        onClick={() => { setActiveStudent(null); setShowFaceModal(true); setTimeout(startCamera, 100); }}
                        className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-4 py-2 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-all text-center"
                      >
                        {preview ? 'Retake Face Scan' : 'Enroll Face via Camera'}
                      </button>
                      <span className="text-[9px] text-slate-500 uppercase font-black mt-2">Live biometric capture required</span>
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-cyan-600 rounded-2xl font-bold text-white mt-4">Save Student</button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showEditModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  const stream = document.getElementById('admin-cam')?.srcObject;
                  stream?.getTracks().forEach(t => t.stop());
                }} 
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"
              >
                <X size={20} />
              </button>
              <h3 className="text-xl font-bold mb-6 font-outfit text-white">Edit Student Details</h3>
              <form onSubmit={handleUpdate} className="space-y-4 text-white">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 text-white">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Username</label>
                    <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={editForm.username} onChange={(e) => setEditForm({...editForm, username: e.target.value})}/>
                    </div>
                    <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Roll No</label>
                    <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={editForm.roll_no} onChange={(e) => setEditForm({...editForm, roll_no: e.target.value})}/>
                    </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Full Name</label>
                  <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={editForm.fullname} onChange={(e) => setEditForm({...editForm, fullname: e.target.value})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Email Address</label>
                  <input type="email" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Assign Class</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none"
                    value={editForm.class_id || ''}
                    onChange={(e) => setEditForm({...editForm, class_id: e.target.value})}
                  >
                    <option value="">No class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}{cls.advisor_name ? ` - ${cls.advisor_name}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Password (Leave blank to keep same)</label>
                  <input type="password" placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-cyan-500 outline-none placeholder:text-slate-700" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})}/>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Update Biometric Photo</label>
                  <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="relative w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10">
                      {preview ? <img src={preview} alt="Current" className="w-full h-full object-cover" /> : <Camera className="text-slate-600" size={24} />}
                    </div>
                    <div className="flex flex-col flex-1">
                      <button 
                        type="button"
                        onClick={() => { setShowFaceModal(true); setTimeout(startCamera, 100); }}
                        className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all text-center"
                      >
                        Scan New Face
                      </button>
                      <span className="text-[9px] text-slate-500 uppercase font-black mt-2">Overrides current face pattern</span>
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-white mt-4 shadow-lg shadow-indigo-600/20">Update Profile</button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showFaceModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-sm p-8 flex flex-col items-center">
              <h3 className="text-lg font-bold mb-2 font-outfit uppercase tracking-widest text-cyan-400">Enroll Face</h3>
              <p className="text-[10px] text-slate-500 mb-8 font-black uppercase tracking-widest text-center text-white">
                  Student: {activeStudent ? activeStudent.fullname : (newStudent.fullname || "New Registration")}
              </p>
              <div className="relative w-64 h-64 rounded-[40px] overflow-hidden border-4 border-cyan-500/30">
                <video id="admin-cam" autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]"/>
                <div className="absolute inset-0 border-[20px] border-slate-900/40 pointer-events-none"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-56 border-2 border-white/20 rounded-full border-dashed animate-pulse"></div>
                </div>
              </div>
              <div className="mt-10 flex flex-col w-full gap-4">
                <button 
                    disabled={capturing} 
                    type="button"
                    onClick={async () => {
                        setCapturing(true);
                        setCaptureProgress(0);
                        const video = document.getElementById('admin-cam');
                        if (!video) {
                            setCapturing(false);
                            return;
                        }
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        
                        let frames = [];
                        // Rapid burst capture (5 images) for professional enrollment
                        for (let i = 0; i < 5; i++) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            frames.push(canvas.toDataURL('image/jpeg', 0.8));
                            setCaptureProgress(Math.round(((i + 1) / 5) * 100));
                            if(i < 4) await new Promise(r => setTimeout(r, 400)); // 400ms delay
                        }
                        
                        setPreview(frames[0]);
                        setCapturedImages(frames);
                        setSelectedFile(frames[0]); // Keep for update backward compatibility
                        
                        const stream = video.srcObject;
                        stream?.getTracks().forEach(t => t.stop());
                        setShowFaceModal(false);
                        setCapturing(false);
                        setCaptureProgress(0);
                    }} 
                    className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl font-black text-xs uppercase text-white shadow-xl shadow-cyan-600/20 relative overflow-hidden"
                >
                    <div 
                        className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-300 pointer-events-none"
                        style={{ width: `${captureProgress}%` }}
                    />
                    <span className="relative z-10">{capturing ? `Capturing Burst... ${captureProgress}%` : "Capture Burst (5 Frames)"}</span>
                </button>
                <button type="button" onClick={() => { const stream = document.getElementById('admin-cam')?.srcObject; stream?.getTracks().forEach(t => t.stop()); setShowFaceModal(false); }} className="w-full py-4 bg-white/5 rounded-3xl font-bold text-xs text-slate-400">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Navbar role="admin" />
    </div>
  );
};

export default ManageStudents;
