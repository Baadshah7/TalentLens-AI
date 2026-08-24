import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, User as UserIcon, ShieldAlert } from 'lucide-react';

const Login = () => {
  const { login, register, setSessionExpired } = useAuth();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Recruiter');
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
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.message);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl glow-accent-violet border border-slate-800/80 z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg glow-accent-violet">
            TL
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isRegister
              ? role === 'Candidate'
                ? 'Create Candidate Account'
                : role === 'Admin'
                  ? 'Create Administrator Account'
                  : 'Create Recruiter Account'
              : 'Sign In to TalentLens'
            }
          </h2>
          <p className="text-sm text-slate-400 mt-1.5">
            {isRegister
              ? role === 'Candidate'
                ? 'Register to practice interviews, take assessments, and get coaching.'
                : 'Register to publish job listings and process candidates.'
              : 'Enter your credentials to access your dashboard'
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-sm flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && !error && (
          <div className="mb-6 p-4 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-indigo-300 text-sm flex items-center space-x-2 animate-pulse">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-indigo-400" />
            <span>{infoMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={handleInputChange(setName)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 transition-all outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={handleInputChange(setEmail)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 transition-all outline-none"
              />
            </div>
          </div>

          {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Account Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('Recruiter')}
                      className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        role === 'Recruiter'
                           ? 'bg-brand-600/10 border-brand-500 text-brand-400 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Recruiter
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('Admin')}
                      className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        role === 'Admin'
                           ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Administrator
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('Candidate')}
                      className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        role === 'Candidate'
                          ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Candidate
                    </button>
                  </div>
                </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="password"
                required
                minLength="6"
                placeholder="••••••••"
                value={password}
                onChange={handleInputChange(setPassword)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 transition-all outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition-all mt-6 shadow-md shadow-brand-950/20 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Please wait...' : (isRegister ? 'Register' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800 pt-5">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setInfoMessage('');
              setSessionExpired(false);
            }}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register Now"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
