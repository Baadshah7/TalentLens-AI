import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Brain, Code, ShieldCheck, Briefcase, Sparkles, UserCheck, 
  ArrowRight, Users, CheckCircle2, Star, Eye, MessageSquare, 
  TrendingUp, Award, Lock, ChevronRight, Check, Zap, Layers
} from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRoleTab, setActiveRoleTab] = useState('candidate'); // 'candidate' | 'recruiter' | 'admin'

  const handlePortalEntry = (rolePreset) => {
    if (user) {
      if (user.Role === 'Candidate') navigate('/assessments');
      else if (user.Role === 'Admin') navigate('/admin/assessments');
      else navigate('/dashboard');
    } else {
      navigate('/login', { state: { role: rolePreset } });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      
      {/* Refined Dual-Color Ambient Glows (Indigo & Cyan Only) */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-cyan-500/10 to-transparent rounded-full blur-[140px] pointer-events-none z-0"></div>
      <div className="absolute top-1/2 -left-48 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
      <div className="absolute bottom-10 right-0 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none z-0"></div>

      {/* Header / Navbar */}
      <header className="border-b border-slate-900/80 bg-slate-950/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center sticky top-0 z-50 transition-all">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-950/50">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-cyan-400 font-black text-lg tracking-wider">
              TL
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-100 text-base tracking-tight leading-none">
              TalentLens <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">AI</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">Enterprise Talent Intelligence</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <button
              onClick={() => handlePortalEntry()}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-lg shadow-indigo-950/50 flex items-center space-x-2 active:scale-95 cursor-pointer"
            >
              <span>Go to Portal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 bg-slate-900/80 hover:bg-slate-900 border border-indigo-500/30 hover:border-indigo-500/60 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center px-6 py-12 md:py-16 text-center max-w-6xl mx-auto space-y-16 relative z-10 w-full">
        
        {/* Top Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/20 text-xs font-medium text-slate-300 shadow-xl backdrop-blur-md">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
          <span className="text-cyan-400 font-semibold">Human-Centered HR Intelligence</span>
          <span className="text-slate-700">•</span>
          <span className="text-slate-300">Explainable Scoring & Blind Screening</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-6 max-w-4xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.12] text-white">
            Transform Talent Evaluation With <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Transparent, Empathetic AI
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto font-normal">
            TalentLens AI standardizes resume parsing, multi-domain technical assessments, and interview evaluation — delivering unbiased insights for recruiters and growth coaching for candidates.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* FEATURED: State-of-the-Art Framed Role Access Console (Directly under Title) */}
        {/* ========================================================================= */}
        <div className="w-full max-w-3xl pt-2">
          <div className="p-1 rounded-3xl bg-gradient-to-b from-indigo-500/30 via-slate-800/40 to-cyan-500/20 backdrop-blur-2xl shadow-2xl shadow-indigo-950/40 border border-indigo-500/20">
            <div className="bg-slate-950/90 rounded-[22px] p-6 sm:p-8 space-y-6 text-left border border-slate-900">
              
              {/* Header inside frame */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
                <div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Portal Entry Console</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mt-1">Select Your Platform Workspace</h3>
                </div>

                {/* Role Switcher Tabs */}
                <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    onClick={() => setActiveRoleTab('candidate')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeRoleTab === 'candidate'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Candidate
                  </button>
                  <button
                    onClick={() => setActiveRoleTab('recruiter')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeRoleTab === 'recruiter'
                        ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Recruiter
                  </button>
                  <button
                    onClick={() => setActiveRoleTab('admin')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeRoleTab === 'admin'
                        ? 'bg-slate-800 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              {/* Dynamic Content Panel Based on Selected Tab */}
              {activeRoleTab === 'candidate' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-start space-x-4">
                    <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl shrink-0">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-100 text-base">Candidate & Learner Portal</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-normal mt-1">
                        Unlock progressive 5-level technical skill benchmarks across 7 domains, receive actionable match breakdown feedback, and practice mock interviews with AI Career Coaching.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-cyan-400" />
                      <span>700 Assessment Questions</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-cyan-400" />
                      <span>AI Mock Interview Coach</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Transparent Skill Badges</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handlePortalEntry('Candidate')}
                      className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-950/50 flex items-center justify-center space-x-2 group cursor-pointer"
                    >
                      <span>Enter Candidate Portal</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {activeRoleTab === 'recruiter' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-start space-x-4">
                    <div className="p-3.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl shrink-0">
                      <Briefcase className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-100 text-base">Recruiter & Hiring Suite</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-normal mt-1">
                        Batch parse unstructured resumes, run unbiased blind screening, simulate custom scoring weights, and conduct live WebRTC video interviews with structured observation tracking.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Blind Mode Unbiased Hiring</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-indigo-400" />
                      <span>What-If Weight Simulation</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-indigo-400" />
                      <span>WebRTC Live Interviews</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handlePortalEntry('Recruiter')}
                      className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center space-x-2 group cursor-pointer"
                    >
                      <span>Enter Recruiter Suite</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {activeRoleTab === 'admin' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-start space-x-4">
                    <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-2xl shrink-0">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-100 text-base">Platform Governance & Admin</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-normal mt-1">
                        Publish and configure domain question sublevels, audit user activities, monitor database operations, and manage enterprise security controls.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Question Bank Publishing</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Audit Compliance Logs</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                      <Check className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Domain Management</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handlePortalEntry('Admin')}
                      className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 group cursor-pointer"
                    >
                      <span>Enter Admin Dashboard</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-indigo-400" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* 4 Metric Highlights Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full pt-4 max-w-4xl">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-indigo-500/15 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-indigo-400">100%</div>
            <div className="text-[11px] text-slate-400 font-semibold mt-1">Explainable AI Scoring</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-cyan-500/15 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-cyan-400">Blind Mode</div>
            <div className="text-[11px] text-slate-400 font-semibold mt-1">Unbiased Screening</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-indigo-500/15 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-indigo-400">700+</div>
            <div className="text-[11px] text-slate-400 font-semibold mt-1">Curated Skill Questions</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-cyan-500/15 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-cyan-400">WebRTC</div>
            <div className="text-[11px] text-slate-400 font-semibold mt-1">Live Video Interviews</div>
          </div>
        </div>

        {/* Core Value Pillars Section */}
        <div className="w-full pt-8 border-t border-slate-900/80 text-left space-y-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">
              <Zap className="h-3.5 w-3.5" />
              <span>Core Architecture Pillars</span>
            </div>
            <h2 className="text-2xl font-black text-slate-100 mt-3">Built for Objectivity & Human Oversight</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-1 font-normal">
              Combining Transaction Processing Systems (TPS) with Decision Support Systems (DSS) to keep recruiters in control and candidates respected.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-850 hover:border-indigo-500/30 transition space-y-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit">
                <Eye className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-slate-200 text-sm">Blind Mode Masking</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Automatically sanitizes candidates' personal details during initial screening, eliminating unconscious bias.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-850 hover:border-cyan-500/30 transition space-y-3">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl w-fit">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-slate-200 text-sm">Explainable Match Engine</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Calculates fit scores with transparent evidence, highlighting exact skill matches and constructive skill gaps.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-850 hover:border-indigo-500/30 transition space-y-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-slate-200 text-sm">AI Career Coaching</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Provides candidate practice sessions with real-time feedback on behavioral and technical interview responses.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-850 hover:border-cyan-500/30 transition space-y-3">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl w-fit">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-slate-200 text-sm">Progressive Skill Benchmarks</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                5-level technical assessment tracks across 7 tech domains with automatic level progression upon passing.
              </p>
            </div>

          </div>
        </div>

        {/* Corporate Trust & Quote Banner */}
        <div className="w-full pt-4">
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/20 backdrop-blur-xl flex flex-col md:flex-row items-center gap-6 text-left shadow-xl">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 p-0.5 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400">
                <Star className="h-7 w-7 fill-cyan-400/20" />
              </div>
            </div>
            <div className="space-y-1.5 flex-1">
              <p className="text-sm md:text-base text-slate-200 font-medium italic leading-relaxed">
                "TalentLens AI standardizes our talent matching with explainable evidence — removing bias while giving candidates full clarity into their evaluation."
              </p>
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 pt-1">
                <span className="text-slate-200">Enterprise Talent Acquisition</span>
                <span>•</span>
                <span className="text-cyan-400">MIS Compliance Standard</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Cleaned Up Footer (Sign-in buttons removed as requested) */}
      <footer className="border-t border-slate-900 py-8 px-6 text-xs text-slate-400 relative z-10 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-xs font-black">
              TL
            </div>
            <span className="font-bold text-slate-200 text-xs">TalentLens AI <span className="text-slate-500 font-normal">| Enterprise MIS</span></span>
          </div>
          
          <p className="text-[11px] text-slate-400 text-center">
            &copy; {new Date().getFullYear()} TalentLens AI. Empowering recruitment with human-in-the-loop intelligence.
          </p>

          {/* Clean Informational / Compliance Links */}
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span className="hover:text-indigo-400 transition cursor-default">Privacy & Integrity</span>
            <span>•</span>
            <span className="hover:text-cyan-400 transition cursor-default">Audit Governance</span>
            <span>•</span>
            <span className="hover:text-slate-300 transition cursor-default">System Status</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
