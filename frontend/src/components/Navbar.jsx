import { useEffect, useState } from 'react';
import { Home, Camera, History, User, Bell, Shield } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import axios from 'axios';

const Navbar = ({ role }) => {
  const location = useLocation();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  const [studentAlertCount, setStudentAlertCount] = useState(0);

  const navItems = {
    student: [
      { path: '/student/dashboard', icon: Home, label: 'Home' },
      { path: '/student/mark', icon: Camera, label: 'Camera' },
      { path: '/student/history', icon: History, label: 'History' },
      { path: '/student/alerts', icon: Bell, label: 'Alerts', badge: studentAlertCount },
    ],
    advisor: [
      { path: '/advisor/dashboard', icon: Home, label: 'Dashboard' },
      { path: '/advisor/reports', icon: History, label: 'Reports' },
      { path: '/advisor/profile', icon: User, label: 'Profile' },
    ],
    admin: [
      { path: '/admin/dashboard', icon: Shield, label: 'Dashboard' },
      { path: '/admin/history', icon: History, label: 'Reports' },
      { path: '/admin/profile', icon: User, label: 'Profile' },
    ]
  };

  const items = navItems[role] || navItems.student;

  useEffect(() => {
    const fetchAlertCount = async () => {
      if (role !== 'student') return;
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API_BASE}/attendance/alerts/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentAlertCount(res.data.count || 0);
      } catch (err) {
        setStudentAlertCount(0);
      }
    };
    fetchAlertCount();
  }, [role, location.pathname]);

  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center px-3 sm:px-6 pointer-events-none z-[100]">
      <nav className="flex w-full max-w-md items-center justify-between gap-1 bg-white/90 premium-blur min-h-[72px] px-2 sm:px-4 rounded-[32px] shadow-2xl shadow-indigo-500/10 border border-white/50 pointer-events-auto">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `relative flex-1 min-w-0 px-2 h-14 flex flex-col items-center justify-center gap-0.5 rounded-[24px] transition-all duration-500 group ${
                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            <item.icon size={22} className="transition-transform duration-500 group-hover:scale-110" />
            <span className="text-[9px] sm:text-[10px] font-bold tracking-tight uppercase opacity-70 truncate">{item.label}</span>
            
            {!!item.badge && (
              <span className="absolute top-1.5 right-2 flex h-4 min-w-[16px] items-center justify-center">
                <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full min-w-[16px] h-4 px-1 bg-red-500 text-[8px] text-white items-center justify-center font-bold">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              </span>
            )}

            {location.pathname === item.path && (
              <span className="absolute -bottom-1 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Navbar;
