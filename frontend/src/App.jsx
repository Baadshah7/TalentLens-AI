import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import CandidateLogin from './pages/CandidateLogin';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import UploadPage from './pages/Upload';
import CandidateDetail from './pages/CandidateDetail';
import CandidateCompare from './pages/CandidateCompare';
import Interviews from './pages/Interviews';
import CandidateCoach from './pages/CandidateCoach';
import Assessments from './pages/Assessments';
import AdminAssessments from './pages/AdminAssessments';
import Results from './pages/Results';

// Auth Route Wrapper
const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Clean candidate portal layout split
  if (user.Role === 'Candidate') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-brand-605 flex items-center justify-center text-white font-black text-base shadow-md">
              TL
            </div>
            <div>
              <span className="font-extrabold text-slate-100 text-sm tracking-tight block">TalentLens Candidate Portal</span>
              <span className="text-[10px] text-slate-500 font-semibold block">Welcome, {user.Name}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
          >
            Sign Out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto relative p-6 md:p-8">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-650/3 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="relative z-10 max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Standard recruiter/admin layout with sidebar
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-100 relative">
      {/* Mobile Top Navbar */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 w-full z-40">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
            TL
          </div>
          <span className="font-semibold text-slate-100 text-sm tracking-tight">TalentLens AI</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-1.5 border border-slate-850 hover:border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 rounded-lg transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 overflow-y-auto max-h-screen relative w-full">
        {/* Glow gradients behind layouts */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
};

const AuthLayout = ({ children }) => {
  const { user } = useAuth();

  if (user) {
    if (user.Role === 'Candidate') {
      return <Navigate to="/assessments" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, sessionExpired } = useAuth();
  const location = useLocation();

  const isCandidateRoute = location.pathname.startsWith('/assessments') || location.pathname.startsWith('/results');

  if (!user) {
    const redirectPath = isCandidateRoute ? '/candidate/login' : '/login';
    if (sessionExpired) {
      return (
        <Navigate 
          to={redirectPath}
          state={{ message: 'Session expired, please log in again', from: location }} 
          replace 
        />
      );
    }
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // Authorization check
  if (allowedRoles && !allowedRoles.includes(user.Role)) {
    if (user.Role === 'Candidate') {
      return <Navigate to="/assessments" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

function AppContent() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthLayout>
            <Login />
          </AuthLayout>
        }
      />
      <Route
        path="/candidate/login"
        element={
          <AuthLayout>
            <CandidateLogin />
          </AuthLayout>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['Recruiter', 'Admin']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute allowedRoles={['Recruiter', 'Admin']}>
            <Jobs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute allowedRoles={['Recruiter', 'Admin']}>
            <UploadPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidate/:id"
        element={
          <ProtectedRoute allowedRoles={['Recruiter', 'Admin']}>
            <CandidateDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/compare"
        element={
          <ProtectedRoute allowedRoles={['Recruiter', 'Admin']}>
            <CandidateCompare />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviews"
        element={
          <ProtectedRoute allowedRoles={['Recruiter', 'Admin']}>
            <Interviews />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assessments"
        element={
          <ProtectedRoute allowedRoles={['Candidate']}>
            <Assessments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assessments"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminAssessments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/results"
        element={
          <ProtectedRoute allowedRoles={['Candidate', 'Recruiter', 'Admin']}>
            <Results />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coach"
        element={
          <ProtectedRoute allowedRoles={['Recruiter', 'Admin']}>
            <CandidateCoach />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
