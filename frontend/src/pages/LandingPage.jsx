import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, Code, ShieldCheck, Briefcase, Sparkles, UserCheck, ShieldAlert, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStart = () => {
    if (user) {
      if (user.Role === 'Candidate') navigate('/assessments');
      else if (user.Role === 'Admin') navigate('/admin/assessments');
      else navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden flex flex-col justify-between">
      {/* Background ambient glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-650/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Header / Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-35">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md glow-accent-violet">
            TL
          </div>
          <span className="font-extrabold text-slate-100 text-base tracking-tight">TalentLens AI</span>
        </div>
        <div className="flex items-center space-x-4">
          {user ? (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              Go to Portal
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-905/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition"
              >
                Sign In
              </button>
              <button
                onClick={handleStart}
                className="px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:py-24 text-center max-w-5xl mx-auto space-y-12 relative z-10">
        
        {/* Intro Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-900/50 text-[10px] font-black uppercase tracking-widest text-indigo-350 shadow-inner animate-pulse">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>TalentLens 2.0 Platform Release</span>
        </div>

        {/* Hero Copy */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight text-white">
            AI-Powered Recruitment. <br />
            <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Fair, Fast, Explainable.
            </span>
          </h1>
          <p className="text-sm md:text-base text-slate-450 leading-relaxed max-w-2xl mx-auto font-medium">
            TalentLens AI standardizes skills assessment and screening pipelines, giving recruiters blind matching tools and candidates AI-guided interview coaching.
          </p>
        </div>

        {/* Main CTA */}
        <button
          onClick={handleStart}
          className="px-7 py-4 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg shadow-indigo-950/40 flex items-center space-x-2 group"
        >
          <span>Begin Assessment & Hiring Journey</span>
          <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Three role paths cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8">
          
          {/* For Recruiters */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 bg-slate-900/10 hover:border-slate-800 transition duration-300 text-left flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="p-3 bg-brand-950/40 border border-brand-900/30 text-brand-450 rounded-xl inline-block shadow-inner">
                <Briefcase className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-slate-200 text-sm">For Recruiters</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Upload resumes to generate explainable scores, filter through bias-free screening criteria, and manage candidate workflows.
              </p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="mt-6 flex items-center space-x-1 text-[10px] text-brand-400 hover:text-brand-300 font-black uppercase tracking-wider group"
            >
              <span>Recruiter Sign-in</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* For Candidates */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 bg-slate-900/10 hover:border-slate-800 transition duration-300 text-left flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="p-3 bg-emerald-950/40 border border-emerald-900/30 text-emerald-450 rounded-xl inline-block shadow-inner">
                <UserCheck className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-slate-200 text-sm">For Candidates</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Practice structured technical assessments, view locks/unlock unlocks on domain path maps, and practice interviews with AI Coaching.
              </p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="mt-6 flex items-center space-x-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-black uppercase tracking-wider group"
            >
              <span>Candidate Sign-in</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* For Admins */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 bg-slate-900/10 hover:border-slate-800 transition duration-300 text-left flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="p-3 bg-indigo-950/40 border border-indigo-900/30 text-indigo-450 rounded-xl inline-block shadow-inner">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-slate-200 text-sm">For Administrators</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Publish assessment sublevels, monitor AI bulk question pools, and inspect system audit logs.
              </p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="mt-6 flex items-center space-x-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-wider group"
            >
              <span>Admin Sign-in</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 py-6 text-center text-[10px] text-slate-600 font-bold tracking-wide relative z-10 bg-slate-950/30">
        &copy; {new Date().getFullYear()} TalentLens AI. All rights reserved.
      </footer>

    </div>
  );
};

export default LandingPage;
