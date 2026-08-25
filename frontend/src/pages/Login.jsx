import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, User as UserIcon, ShieldAlert } from 'lucide-react';

const Login = () => {
  const { login, register, setSessionExpired } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Recruiter'); // Recruiter, Candidate, Admin
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState(location.state?.message || '');
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    setError('');
    setInfoMessage('');
    setSessionExpired(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setSessionExpired(false);
    setSubmitting(true);

    try {
      if (isRegister) {
        const res = await register(name, email, role, password);
        if (!res.success) {
          setError(res.message);
        } else {
          // Registration success automatically logs in and redirects
          const storedUser = JSON.parse(sessionStorage.getItem('user'));
          redirectUser(storedUser);
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.message);
        } else {
          const storedUser = JSON.parse(sessionStorage.getItem('user'));
          if (storedUser) {
            setRole(storedUser.Role);
            redirectUser(storedUser);
          }
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const redirectUser = (userObj) => {
    if (!userObj) return;
    if (userObj.Role === 'Candidate') {
      navigate('/assessments');
    } else if (userObj.Role === 'Admin') {
      navigate('/admin/assessments');
    } else {
      navigate('/dashboard');
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setRole('Recruiter');
    setError('');
    setInfoMessage('');
    setSessionExpired(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-650/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl glow-accent-violet border border-slate-800/80 z-10 bg-slate-900/40 backdrop-blur-md">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg glow-accent-violet">
            TL
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isRegister
              ? role === 'Candidate'
                ? 'Create Candidate Account'
                : 'Create Recruiter Account'
              : `Sign In as ${role}`
            }
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            {isRegister
              ? role === 'Candidate'
                ? 'Register to practice interviews, take assessments, and get coaching.'
                : 'Register to publish job listings and process candidates.'
              : `Enter your ${role.toLowerCase()} credentials to access the TalentLens portal`
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-955 border border-rose-900 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
            <ShieldAlert className="h-4.5 w-4.5 flex-shrink-0 text-rose-450" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && !error && (
          <div className="mb-6 p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-indigo-300 text-xs flex items-center space-x-2 animate-pulse">
            <ShieldAlert className="h-4.5 w-4.5 flex-shrink-0 text-indigo-400" />
            <span>{infoMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role Segment Selector */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-405 uppercase tracking-widest">Platform Role</label>
            <div className={`grid ${isRegister ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
              <button
                type="button"
                onClick={() => setRole('Recruiter')}
                className={`py-2 rounded-xl border text-[11px] font-extrabold transition-all duration-200 ${
                  role === 'Recruiter'
                    ? 'bg-brand-600/10 border-brand-500 text-brand-400 shadow-sm'
                    : 'bg-slate-950 border-slate-850 text-slate-500 hover:border-slate-800'
                }`}
              >
                Recruiter
              </button>
              <button
                type="button"
                onClick={() => setRole('Candidate')}
                className={`py-2 rounded-xl border text-[11px] font-extrabold transition-all duration-200 ${
                  role === 'Candidate'
                    ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 shadow-sm'
                    : 'bg-slate-950 border-slate-850 text-slate-500 hover:border-slate-800'
                }`}
              >
                Candidate
              </button>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => setRole('Admin')}
                  className={`py-2 rounded-xl border text-[11px] font-extrabold transition-all duration-200 ${
                    role === 'Admin'
                      ? 'bg-indigo-650/10 border-indigo-500 text-indigo-400 shadow-sm'
                      : 'bg-slate-950 border-slate-850 text-slate-500 hover:border-slate-800'
                  }`}
                >
                  Admin
                </button>
              )}
            </div>
          </div>

          {isRegister && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-405 uppercase tracking-widest">Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={handleInputChange(setName)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-xs text-slate-100 placeholder-slate-550 transition-all outline-none font-medium"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-405 uppercase tracking-widest">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="e.g. you@example.com"
                value={email}
                onChange={handleInputChange(setEmail)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-xs text-slate-100 placeholder-slate-555 transition-all outline-none font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-405 uppercase tracking-widest">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                minLength="6"
                placeholder="••••••••"
                value={password}
                onChange={handleInputChange(setPassword)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-xs text-slate-100 placeholder-slate-555 transition-all outline-none font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition-all mt-6 shadow-md shadow-brand-950/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            {submitting ? 'Please wait...' : (isRegister ? 'Register' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-855 pt-5">
          <button
            onClick={toggleMode}
            className="text-xs text-brand-400 hover:text-brand-300 font-bold hover:underline"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register Now"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Login;
