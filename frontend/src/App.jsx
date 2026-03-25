import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import StudentDashboard from './pages/student/Dashboard';
import MarkAttendance from './pages/student/MarkAttendance';
import Alerts from './pages/student/Alerts';
import StudentHistory from './pages/student/History';
import AdvisorDashboard from './pages/advisor/Dashboard';
import ManageStudentsAdv from './pages/advisor/ManageStudentsAdv';
import AttendanceAnalyticsAdv from './pages/advisor/AttendanceAnalyticsAdv';
import Broadcast from './pages/advisor/Broadcast';
import AdvisorReports from './pages/advisor/Reports';
import AdvisorProfile from './pages/advisor/Profile';
import AdminDashboard from './pages/admin/Dashboard';
import ManageStudents from './pages/admin/ManageStudents';
import ManageAdvisors from './pages/admin/ManageAdvisors';
import AttendanceHistory from './pages/admin/AttendanceHistory';
import Analytics from './pages/admin/Analytics';
import AdminProfile from './pages/admin/AdminProfile';
import { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen relative pb-20 bg-slate-950 text-white selection:bg-cyan-500/30 selection:text-cyan-400">
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          
          {/* Student Routes */}
          <Route path="/student/mark" element={user?.role === 'student' ? <MarkAttendance /> : <Navigate to="/login" />} />
          <Route path="/student/dashboard" element={user?.role === 'student' ? <StudentDashboard /> : <Navigate to="/login" />} />
          <Route path="/student/history" element={user?.role === 'student' ? <StudentHistory /> : <Navigate to="/login" />} />
          <Route path="/student/alerts" element={user?.role === 'student' ? <Alerts /> : <Navigate to="/login" />} />
          <Route path="/student/*" element={<Navigate to="/student/dashboard" />} />
          
          {/* Advisor Routes */}
          <Route path="/advisor/dashboard" element={user?.role === 'advisor' ? <AdvisorDashboard /> : <Navigate to="/login" />} />
          <Route path="/advisor/manage-students" element={user?.role === 'advisor' ? <ManageStudentsAdv /> : <Navigate to="/login" />} />
          <Route path="/advisor/analytics" element={user?.role === 'advisor' ? <AttendanceAnalyticsAdv /> : <Navigate to="/login" />} />
          <Route path="/advisor/broadcast" element={user?.role === 'advisor' ? <Broadcast /> : <Navigate to="/login" />} />
          <Route path="/advisor/reports" element={user?.role === 'advisor' ? <AdvisorReports /> : <Navigate to="/login" />} />
          <Route path="/advisor/profile" element={user?.role === 'advisor' ? <AdvisorProfile /> : <Navigate to="/login" />} />
          <Route path="/advisor/*" element={<Navigate to="/advisor/dashboard" />} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
          <Route path="/admin/students" element={user?.role === 'admin' ? <ManageStudents /> : <Navigate to="/login" />} />
          <Route path="/admin/advisors" element={user?.role === 'admin' ? <ManageAdvisors /> : <Navigate to="/login" />} />
          <Route path="/admin/history" element={user?.role === 'admin' ? <AttendanceHistory /> : <Navigate to="/login" />} />
          <Route path="/admin/analytics" element={user?.role === 'admin' ? <Analytics /> : <Navigate to="/login" />} />
          <Route path="/admin/profile" element={user?.role === 'admin' ? <AdminProfile /> : <Navigate to="/login" />} />
          <Route path="/admin/*" element={<Navigate to="/admin/dashboard" />} />
          
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
