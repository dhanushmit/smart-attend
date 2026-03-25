import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../components/GlassCard';
import Navbar from '../../components/Navbar';
import { Search, Shield, UserPlus, Edit2, Trash2, ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ManageAdvisors = () => {
    const navigate = useNavigate();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [advisors, setAdvisors] = useState([]);
    const [classes, setClasses] = useState([]);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAdvisor, setEditingAdvisor] = useState(null);
    const [newAdvisor, setNewAdvisor] = useState({
      username: '',
      fullname: '',
      email: '',
      password: '',
      class_id: '',
      class_name: ''
    });
  
    const fetchAdvisors = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/admin/advisors`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAdvisors(res.data);
      } catch (err) {
        console.error(err);
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
        console.error(err);
      }
    };
  
    useEffect(() => {
      fetchAdvisors();
      fetchClasses();
    }, []);
  
    const handleAdd = async (e) => {
      e.preventDefault();
      try {
        const token = localStorage.getItem('token');
        if (editingAdvisor) {
            await axios.put(`${API_BASE}/admin/advisors/${editingAdvisor.id}`, newAdvisor, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } else {
            await axios.post(`${API_BASE}/admin/advisors`, newAdvisor, {
                headers: { Authorization: `Bearer ${token}` }
            });
        }
        setShowAddModal(false);
        setEditingAdvisor(null);
        alert(editingAdvisor
          ? `Advisor updated. Login username: ${newAdvisor.username}. Use the new password you entered.`
          : `Advisor created. Login username: ${newAdvisor.username}`);
        setNewAdvisor({ username: '', fullname: '', email: '', password: '', class_id: '', class_name: '' });
        fetchAdvisors();
        fetchClasses();
      } catch (err) {
        alert(err.response?.data?.msg || "Action failed");
      }
    };

    const handleEdit = (advisor) => {
        setEditingAdvisor(advisor);
        setNewAdvisor({
            username: advisor.username,
            fullname: advisor.fullname,
            email: advisor.email,
            password: '',
            class_id: advisor.class_id || '',
            class_name: advisor.class_name || ''
        });
        setShowAddModal(true);
    };
  
    const handleDelete = async (id) => {
      if (!window.confirm("Delete this advisor?")) return;
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE}/admin/advisors/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchAdvisors();
      } catch (err) {
        alert("Error deleting advisor");
      }
    };
  
    const filtered = advisors.filter(a => 
      a.fullname.toLowerCase().includes(search.toLowerCase()) || 
      a.email.toLowerCase().includes(search.toLowerCase())
    );
  
    return (
      <div className="p-6 pb-24">
        <header className="mb-6 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/10">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold font-outfit text-indigo-400">Manage Advisors</h2>
            <p className="text-xs text-slate-400">System Authorities</p>
          </div>
        </header>
  
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search advisors..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:border-indigo-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 p-3 rounded-2xl flex items-center justify-center hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
          >
            <UserPlus size={20} />
          </button>
        </div>
  
        <div className="space-y-4">
          {filtered.map((advisor, i) => (
            <GlassCard key={advisor.id} delay={i * 0.05} className="flex items-center gap-4 p-4 border-l-4 border-indigo-500">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 border border-indigo-500/30">
                  {advisor.fullname.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate">{advisor.fullname}</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">{advisor.username}</p>
                <p className="text-[10px] text-slate-500 font-medium italic">{advisor.email}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(advisor)}
                  className="p-2 bg-white/5 rounded-xl border border-white/10 hover:text-indigo-400"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(advisor.id)}
                  className="p-2 bg-white/5 rounded-xl border border-white/10 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
  
        <AnimatePresence>
          {showAddModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 relative"
              >
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingAdvisor(null);
                    setNewAdvisor({ username: '', fullname: '', email: '', password: '', class_id: '', class_name: '' });
                  }}
                  className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"
                >
                  <X size={20} />
                </button>
                
                <h3 className="text-xl font-bold mb-6 font-outfit text-indigo-400">
                    {editingAdvisor ? 'Edit Advisor Details' : 'New Class Advisor'}
                </h3>
                
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Username</label>
                    <input 
                      type="text" 
                      required
                      disabled={!!editingAdvisor}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none disabled:opacity-60"
                      value={newAdvisor.username}
                      onChange={(e) => setNewAdvisor({...newAdvisor, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Full Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none"
                      value={newAdvisor.fullname}
                      onChange={(e) => setNewAdvisor({...newAdvisor, fullname: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Email Address</label>
                    <input 
                      type="email" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none"
                      value={newAdvisor.email}
                      onChange={(e) => setNewAdvisor({...newAdvisor, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Assign Existing Class</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none"
                      value={newAdvisor.class_id}
                      onChange={(e) => setNewAdvisor({...newAdvisor, class_id: e.target.value, class_name: ''})}
                    >
                      <option value="">No existing class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">Or Create New Class</label>
                    <input 
                      type="text" 
                      placeholder="Example: III CSE A"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none"
                      value={newAdvisor.class_name}
                      onChange={(e) => setNewAdvisor({...newAdvisor, class_name: e.target.value, class_id: ''})}
                    />
                  </div>
  
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-2">
                        {editingAdvisor ? 'New Password (Optional)' : 'Default Password'}
                    </label>
                    <input 
                      type="password" 
                      placeholder={editingAdvisor ? 'Leave blank to keep current' : 'Enter password'}
                      required={!editingAdvisor}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none"
                      value={newAdvisor.password}
                      onChange={(e) => setNewAdvisor({...newAdvisor, password: e.target.value})}
                    />
                  </div>

                  <div className="pt-4">
                      <button 
                          type="submit"
                          className="w-full py-4 bg-indigo-600 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all font-outfit"
                      >
                          {editingAdvisor ? 'Update Advisor Credentials' : 'Deploy Advisor'}
                      </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
  
        <Navbar role="admin" />
      </div>
    );
};

export default ManageAdvisors;
