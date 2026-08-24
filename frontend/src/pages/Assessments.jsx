import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Brain, Code, Shield, Smartphone, Database, Sparkles, Scale,
  Lock, CheckCircle2, ChevronLeft, ChevronRight, ArrowRight, Play, RefreshCw, 
  HelpCircle, Timer, Award, Flame, ClipboardList, Check, X, XCircle, ChevronDown, CheckSquare
} from 'lucide-react';

const Assessments = () => {
  const { user } = useAuth();
  
  // Navigation states
  const [activeDomain, setActiveDomain] = useState(null);
  const [activeSubLevel, setActiveSubLevel] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null);
  
  // Data lists
  const [domains, setDomains] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [progressSummary, setProgressSummary] = useState(null);
  
  // Quiz states
  const [answers, setAnswers] = useState(Array(25).fill(-1));
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const [quizResult, setQuizResult] = useState(null);
  
  // Accordion details for answers review
  const [expandedAnswers, setExpandedAnswers] = useState({});

  // Loading / Error states
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [error, setError] = useState('');

  // CSS Confetti State
  const [showConfetti, setShowConfetti] = useState(false);

  // Get Domain Icon component
  const getDomainIcon = (slug, sizeClass = "h-6 w-6") => {
    switch (slug?.toLowerCase()) {
      case 'brain': return <Brain className={`${sizeClass} text-pink-400`} />;
      case 'code': return <Code className={`${sizeClass} text-sky-400`} />;
      case 'shield': return <Shield className={`${sizeClass} text-emerald-400`} />;
      case 'smartphone': return <Smartphone className={`${sizeClass} text-violet-400`} />;
      case 'database': return <Database className={`${sizeClass} text-amber-400`} />;
      case 'sparkles': return <Sparkles className={`${sizeClass} text-indigo-400`} />;
      case 'scale': return <Scale className={`${sizeClass} text-rose-400`} />;
      default: return <HelpCircle className={`${sizeClass} text-slate-400`} />;
    }
  };

  // Prevent accidental navigation off an active test attempt
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeAttempt && !quizResult) {
        e.preventDefault();
        e.returnValue = "Are you sure you want to exit? Your attempt progress will be lost.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeAttempt, quizResult]);

  const renderBreadcrumbs = () => {
    return (
      <div className="flex items-center space-x-2 text-[11px] text-slate-500 mb-6 font-bold select-none border-b border-slate-900 pb-3">
        <span 
          className="hover:text-slate-300 cursor-pointer transition duration-150"
          onClick={() => {
            if (!activeAttempt || window.confirm("Are you sure you want to exit the active assessment? Your current attempt progress will be lost.")) {
              setActiveDomain(null);
              setActiveSubLevel(null);
              setActiveAttempt(null);
              setQuizResult(null);
            }
          }}
        >
          Domains
        </span>
        {activeDomain && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-700" />
            <span 
              className={`transition duration-150 ${activeSubLevel ? 'hover:text-slate-300 cursor-pointer' : 'text-indigo-400 font-extrabold'}`}
              onClick={() => {
                if (activeSubLevel) {
                  if (!activeAttempt || window.confirm("Are you sure you want to exit the active assessment? Your current attempt progress will be lost.")) {
                    setActiveSubLevel(null);
                    setActiveAttempt(null);
                    setQuizResult(null);
                  }
                }
              }}
            >
              {activeDomain.Name}
            </span>
          </>
        )}
        {activeSubLevel && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-700" />
            <span className="text-indigo-400 font-extrabold">
              Level {activeSubLevel.Level_Number}
            </span>
          </>
        )}
      </div>
    );
  };

  // Load domains & summary on entry
  const loadDomainList = async () => {
    try {
      setDomainsLoading(true);
      const [domRes, sumRes] = await Promise.all([
        axios.get('/assessments/domains'),
        axios.get('/assessments/users/progress-summary')
      ]);
      setDomains(domRes.data);
      setProgressSummary(sumRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load assessment domain dashboard.');
    } finally {
      setDomainsLoading(false);
    }
  };

  useEffect(() => {
    loadDomainList();
  }, []);

  // Fetch track map when domain is selected
  const handleSelectDomain = async (domain) => {
    setActiveDomain(domain);
    setTracksLoading(true);
    try {
      const res = await axios.get(`/assessments/domains/${domain.Domain_ID}/tracks`);
      setTracks(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to retrieve level track map.');
    } finally {
      setTracksLoading(false);
    }
  };

  // Fetch track map refresher
  const refreshTrackMap = async () => {
    if (!activeDomain) return;
    try {
      const res = await axios.get(`/assessments/domains/${activeDomain.Domain_ID}/tracks`);
      setTracks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Start attempt on sub-level node click
  const handleStartLevel = async (subLevel) => {
    setActiveSubLevel(subLevel);
    setQuestionsLoading(true);
    setError('');
    setQuizResult(null);
    setAnswers(Array(25).fill(-1));
    setCurrentQuestionIdx(0);
    setExpandedAnswers({});
    setShowConfetti(false);
    
    try {
      // 1. Create Attempt Entry on backend
      const attemptRes = await axios.post(`/assessments/sub-levels/${subLevel.Sub_Level_ID}/attempts`);
      setActiveAttempt(attemptRes.data);
      
      // 2. Fetch Shuffled Questions
      const questionsRes = await axios.get(`/assessments/sub-levels/${subLevel.Sub_Level_ID}/questions`);
      setQuestions(questionsRes.data);
      
      // 3. Initialize Timer (minutes to seconds)
      setTimeLeft((subLevel.Time_Limit_Minutes || 30) * 60);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start quiz attempt.');
      setActiveSubLevel(null);
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Timer Tick implementation
  useEffect(() => {
    if (!activeSubLevel || quizResult) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timerRef.current);
  }, [activeSubLevel, quizResult]);

  // Record answer selection
  const selectOption = (qIdx, optIdx) => {
    const copy = [...answers];
    copy[qIdx] = optIdx;
    setAnswers(copy);
  };

  // Automated submit if timer expires
  const handleAutoSubmit = () => {
    handleSubmit(true);
  };

  // Submit test to backend server-side evaluation
  const handleSubmit = async (isAuto = false) => {
    if (!activeAttempt || !activeSubLevel) return;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setSubmittingQuiz(true);
    setError('');
    
    // Format answers array payload
    const formattedAnswers = questions.map((q, idx) => ({
      Question_ID: q.Question_ID,
      Selected_Option_Index: answers[idx] === -1 ? null : answers[idx]
    }));
    
    // Compute duration taken
    const totalTimeLimit = (activeSubLevel.Time_Limit_Minutes || 30) * 60;
    const timeTaken = totalTimeLimit - timeLeft;

    try {
      const res = await axios.post(`/assessments/attempts/${activeAttempt.Attempt_ID}/submit`, {
        Answers: formattedAnswers,
        Time_Taken_Seconds: timeTaken
      });
      setQuizResult(res.data);
      
      // Trigger CSS Confetti on Pass
      if (res.data.Is_Passed) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
      }
      
      // Refresh global progress numbers
      const sumRes = await axios.get('/assessments/users/progress-summary');
      setProgressSummary(sumRes.data);
      refreshTrackMap();
    } catch (err) {
      console.error(err);
      setError('An error occurred while evaluating your attempt.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // Accordion toggle helper for results review
  const toggleExplanation = (idx) => {
    setExpandedAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const formatTime = (s) => {
    const mm = Math.floor(s/60).toString().padStart(2,'0');
    const ss = (s%60).toString().padStart(2,'0');
    return `${mm}:${ss}`;
  };

  // Navigation exits
  const exitQuizToPath = () => {
    setActiveSubLevel(null);
    setActiveAttempt(null);
    setQuizResult(null);
    setQuestions([]);
  };

  // ==========================================
  // Layout 1: Domain Selection Dashboard
  // ==========================================
  if (!activeDomain) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {renderBreadcrumbs()}
        
        {/* Progress Stats Summary Banner */}
        {progressSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <div className="flex items-center space-x-3.5 px-4 py-2 border-r border-slate-800 last:border-0">
              <div className="p-3 bg-indigo-950/60 rounded-xl border border-indigo-900/40 text-indigo-400">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Score XP</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.xp} <span className="text-xs text-indigo-400">XP</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-3.5 px-4 py-2 md:border-r border-slate-800 last:border-0">
              <div className="p-3 bg-amber-950/60 rounded-xl border border-amber-900/40 text-amber-400 animate-pulse">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Daily Streak</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.streak} <span className="text-xs text-amber-400">days 🔥</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-3.5 px-4 py-2 border-r border-slate-800 last:border-0">
              <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-900/40 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Passed Levels</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.completed_levels} <span className="text-xs text-emerald-400">nodes</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-3.5 px-4 py-2 last:border-0">
              <div className="p-3 bg-violet-950/60 rounded-xl border border-violet-900/40 text-violet-400">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Quiz Attempts</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.total_attempts} <span className="text-xs text-violet-400">times</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Title */}
        <div className="space-y-1">
          <h3 className="text-xl font-extrabold text-white">Select Assessment Domain</h3>
          <p className="text-xs text-slate-400">Choose a specialized technological category to test and expand your capabilities.</p>
        </div>

        {/* Domains Grid */}
        {domainsLoading ? (
          <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-650" />
            <p className="text-xs font-bold">Retrieving evaluation domain structures...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {domains.map(d => (
              <div 
                key={d.Domain_ID}
                onClick={() => handleSelectDomain(d)}
                className="glass-panel border border-slate-850 hover:border-slate-800 rounded-2xl p-5 hover:bg-slate-900/20 transition-all duration-300 cursor-pointer shadow-sm group hover:-translate-y-1 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 group-hover:border-slate-800 transition-colors">
                      {getDomainIcon(d.Icon_Slug)}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-950 border border-slate-900 text-slate-400">
                      15 Sublevels
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-100 text-sm group-hover:text-indigo-400 transition-colors">{d.Name}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{d.Description}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-5 pt-3 border-t border-slate-900">
                  <div className="flex justify-between text-[10px] text-slate-450 font-bold mb-1">
                    <span>Overall Completion</span>
                    <span className="text-indigo-400">{d.Completion_Percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-600 to-brand-500 rounded-full"
                      style={{ width: `${d.Completion_Percentage}%` }}
                    ></div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    );
  }

  // ==========================================
  // Layout 2: Duolingo-Style Path Map
  // ==========================================
  if (activeDomain && !activeSubLevel) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300 max-w-xl mx-auto">
        {renderBreadcrumbs()}
        
        {/* Header back button */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <button 
            onClick={() => setActiveDomain(null)}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition font-bold"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Return to Categories</span>
          </button>
          <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-1.5">
            {getDomainIcon(activeDomain.Icon_Slug, "h-4.5 w-4.5")}
            <span>{activeDomain.Name} Path</span>
          </h3>
        </div>

        {/* Path Loading */}
        {tracksLoading ? (
          <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-650" />
            <p className="text-xs font-bold">Structuring level map nodes...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {tracks.map((t, tIdx) => {
              // A track is visually locked on frontend if it is not Beginner and Level 1 of it is locked
              const firstLevel = t.Sub_Levels[0];
              const isTrackLocked = firstLevel ? !firstLevel.Is_Unlocked : true;
              
              return (
                <div key={t.Track_ID} className={`relative p-5 rounded-2xl ${isTrackLocked ? 'bg-slate-950/20 border border-slate-905 opacity-55' : 'bg-slate-900/10 border border-slate-900'} space-y-6 shadow-sm`}>
                  
                  {/* Track Title */}
                  <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                    <div>
                      <h4 className="font-extrabold text-sm tracking-wide text-slate-200 uppercase">{t.Name} Track</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Complete levels sequentially to earn XP points</p>
                    </div>
                    {isTrackLocked && (
                      <span className="flex items-center space-x-1 text-[10px] bg-slate-950 border border-slate-900 text-slate-400 px-2 py-0.5 rounded-lg font-bold">
                        <Lock className="h-3 w-3 text-slate-500" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>

                  {/* Connected Duolingo Nodes Map */}
                  <div className="flex flex-col items-center py-6 relative space-y-8">
                    {/* Winding Offset Nodes */}
                    {t.Sub_Levels.map((sl, slIdx) => {
                      // Generate offsets: left, center, right, center, left
                      const offsets = [
                        "translate-x-0",
                        "translate-x-6 md:translate-x-10",
                        "translate-x-12 md:translate-x-20",
                        "translate-x-6 md:translate-x-10",
                        "translate-x-0"
                      ];
                      const offsetClass = offsets[slIdx % offsets.length];

                      return (
                        <div 
                          key={sl.Sub_Level_ID}
                          className={`transform ${offsetClass} transition-transform duration-300 flex flex-col items-center relative group z-10`}
                        >
                          {/* Node Connection Vector Line (vertical connecting lines) */}
                          {slIdx < t.Sub_Levels.length - 1 && (
                            <div className="absolute top-12 left-6 w-0.5 h-12 bg-slate-800 pointer-events-none z-0"></div>
                          )}

                          {/* Node Button */}
                          <button
                            disabled={!sl.Is_Unlocked}
                            onClick={() => handleStartLevel(sl)}
                            className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-xs shadow-md border transition-all duration-300 active:scale-95 ${
                              sl.Is_Completed
                                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                                : sl.Is_Unlocked
                                  ? 'bg-gradient-to-tr from-indigo-650 to-brand-600 border-indigo-500 text-white animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                                  : 'bg-slate-950 border-slate-850 text-slate-600 cursor-not-allowed'
                            }`}
                            title={sl.Is_Unlocked ? `Start Level ${sl.Level_Number}` : 'Level Locked'}
                          >
                            {sl.Is_Completed ? (
                              <Check className="h-5 w-5 stroke-[3px]" />
                            ) : sl.Is_Unlocked ? (
                              <span>L{sl.Level_Number}</span>
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Hover details badge */}
                          <div className="mt-2 text-center">
                            <span className="text-[10px] font-bold text-slate-350">{sl.Name}</span>
                            {sl.Is_Completed ? (
                              <span className="block text-[8px] text-emerald-400 font-extrabold">Best: {sl.Best_Score.toFixed(0)}%</span>
                            ) : sl.Is_Unlocked ? (
                              <span className="block text-[8px] text-indigo-400 font-extrabold uppercase animate-pulse">Start</span>
                            ) : (
                              <span className="block text-[8px] text-slate-600 font-medium">Locked</span>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    );
  }

  // ==========================================
  // Layout 3: Active Quiz Taking Screen
  // ==========================================
  if (activeSubLevel && activeAttempt && !quizResult) {
    const currentQ = questions[currentQuestionIdx];
    
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
        {renderBreadcrumbs()}
        
        {/* Header toolbar */}
        <div className="glass-panel border border-slate-900 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center bg-slate-900/40 backdrop-blur-md gap-3 shadow-md">
          <div className="flex items-center space-x-3 text-center md:text-left">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-900">
              {getDomainIcon(activeDomain.Icon_Slug, "h-5 w-5")}
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">
                {activeDomain.Name} — Level {activeSubLevel.Level_Number}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Attempt #{activeAttempt.Attempt_Number} • Pass score: 70% (18/25)</p>
            </div>
          </div>
          
          {/* Active Timer */}
          <div className={`px-4 py-2 border rounded-xl flex items-center space-x-2 font-mono text-sm font-bold shadow-inner ${
            timeLeft < 120 
              ? 'border-rose-900/50 bg-rose-950/20 text-rose-400 animate-pulse' 
              : 'border-slate-800 bg-slate-950/40 text-indigo-400'
          }`}>
            <Timer className="h-4.5 w-4.5 text-current" />
            <span>Time Left: {formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Progress indicators */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-bold">
            <span>Question {currentQuestionIdx + 1} of 25</span>
            <span>{((currentQuestionIdx + 1) / 25 * 100).toFixed(0)}% Completed</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-indigo-650 to-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIdx + 1) / 25) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Core Layout split: Question vs Grid Navigator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: MCQ Question Card */}
          <div className="lg:col-span-2 space-y-6">
            {questionsLoading ? (
              <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500 bg-slate-900/40">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-650" />
                <p className="text-xs font-bold">Loading level questions pool...</p>
              </div>
            ) : currentQ ? (
              <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 bg-slate-900/40 backdrop-blur-md shadow-lg space-y-5 animate-in fade-in slide-in-from-left-2 duration-300">
                {/* Question Prompt */}
                <h4 className="text-sm font-extrabold text-slate-100 leading-relaxed">
                  {currentQuestionIdx + 1}. {currentQ.Question_Text}
                </h4>

                {/* Option Buttons */}
                <div className="grid grid-cols-1 gap-3 pt-2">
                  {currentQ.Options.map((opt, oIdx) => {
                    const isSelected = answers[currentQuestionIdx] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => selectOption(currentQuestionIdx, oIdx)}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border text-xs font-bold transition-all duration-200 active:scale-[0.99] flex items-center justify-between shadow-sm ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-inner' 
                            : 'border-slate-800 hover:border-slate-700 bg-slate-950/20 text-slate-350 hover:text-slate-150'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5 pr-2">
                          <span className={`h-6 w-6 rounded-lg flex items-center justify-center border font-black flex-shrink-0 ${
                            isSelected 
                              ? 'bg-indigo-600/20 border-indigo-400 text-indigo-300' 
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="leading-relaxed">{opt}</span>
                        </div>
                        <div className={`h-4 w-4 rounded-full border flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-700'}`}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white"></div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Navigation buttons */}
            <div className="flex justify-between items-center text-xs">
              <button
                onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIdx === 0}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900/60 disabled:opacity-30 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition disabled:active:scale-100"
              >
                Previous Question
              </button>
              
              {currentQuestionIdx < 24 ? (
                <button
                  onClick={() => setCurrentQuestionIdx(prev => Math.min(24, prev + 1))}
                  className="px-4.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl font-bold transition active:scale-95"
                >
                  Next Question
                </button>
              ) : (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submittingQuiz}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-555 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black transition active:scale-95 shadow-md flex items-center space-x-1.5"
                >
                  {submittingQuiz ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Answers</span>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Grid Navigator Panel */}
          <div className="space-y-4">
            <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 backdrop-blur-md shadow-lg space-y-4">
              <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-850 pb-2">
                Question Navigator
              </h4>

              {/* Grid 5x5 */}
              <div className="grid grid-cols-5 gap-2.5">
                {Array.from({ length: 25 }).map((_, idx) => {
                  const isCurrent = currentQuestionIdx === idx;
                  const isAnswered = answers[idx] !== -1;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentQuestionIdx(idx)}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs transition duration-200 active:scale-90 ${
                        isCurrent
                          ? 'border-2 border-indigo-500 bg-indigo-950/50 text-indigo-300 font-black shadow-inner shadow-indigo-900/20'
                          : isAnswered
                            ? 'bg-slate-900 border border-slate-800 text-slate-100'
                            : 'bg-slate-950/40 border border-slate-905 text-slate-500 hover:border-slate-800'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Status indicators */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-850 text-[9px] text-slate-500 font-bold">
                <span className="flex items-center space-x-1">
                  <span className="h-2 w-2 rounded bg-slate-900 border border-slate-800"></span>
                  <span>Answered</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="h-2 w-2 rounded bg-slate-950/40 border border-slate-905"></span>
                  <span>Unanswered</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="h-2 w-2 rounded border-2 border-indigo-500 bg-indigo-950/50"></span>
                  <span>Viewing</span>
                </span>
              </div>
            </div>

            {/* Quick Submit Widget */}
            <button
              onClick={() => handleSubmit(false)}
              disabled={submittingQuiz}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-bold transition shadow-sm active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <span>Submit Assessment Set</span>
            </button>
          </div>

        </div>

      </div>
    );
  }

  // ==========================================
  // Layout 4: Quiz Results Screen
  // ==========================================
  if (quizResult) {
    const totalQ = quizResult.Correct_Count + quizResult.Incorrect_Count + quizResult.Skipped_Count;
    
    return (
      <div className="space-y-8 animate-in fade-in duration-300 max-w-3xl mx-auto relative">
        {renderBreadcrumbs()}
        
        {/* CSS Particle Confetti */}
        {showConfetti && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
            {Array.from({ length: 40 }).map((_, idx) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 3;
              const duration = 2 + Math.random() * 3;
              const colors = ["bg-indigo-500", "bg-emerald-500", "bg-pink-500", "bg-amber-400", "bg-sky-400"];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              
              return (
                <div 
                  key={idx}
                  className={`absolute top-[-20px] w-2.5 h-2.5 rounded-full ${randomColor} animate-confetti`}
                  style={{
                    left: `${left}%`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`
                  }}
                ></div>
              );
            })}
          </div>
        )}

        {/* Banner header: Pass/Fail */}
        <div className={`glass-panel border rounded-2xl p-8 text-center shadow-xl relative overflow-hidden ${
          quizResult.Is_Passed 
            ? 'border-emerald-500/25 bg-emerald-950/10' 
            : 'border-rose-900/30 bg-rose-950/10'
        }`}>
          {quizResult.Is_Passed ? (
            <div className="space-y-4">
              <div className="inline-flex p-4 bg-emerald-950 border border-emerald-900 rounded-full text-emerald-400 shadow-inner animate-bounce">
                <Award className="h-9 w-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-emerald-400 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Level Passed! 🎉</h3>
                <p className="text-xs text-slate-400">Excellent job! The next level is now unlocked on your path map.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="inline-flex p-4 bg-rose-950 border border-rose-900 rounded-full text-rose-400 shadow-inner">
                <XCircle className="h-9 w-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-rose-400">Level Attempt Incomplete</h3>
                <p className="text-xs text-slate-450">Close attempt! Review the question explanations below and try again.</p>
              </div>
            </div>
          )}
        </div>

        {/* Metrics details */}
        <div className="grid grid-cols-3 gap-5 text-center">
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Score Achieved</span>
            <span className={`text-xl font-black mt-1 block ${quizResult.Is_Passed ? 'text-emerald-400' : 'text-rose-400'}`}>
              {quizResult.Score_Percent.toFixed(0)}%
            </span>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Questions Correct</span>
            <span className="text-xl font-black mt-1 block text-slate-200">{quizResult.Correct_Count} / {totalQ}</span>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Skipped/Incorrect</span>
            <span className="text-xl font-black mt-1 block text-slate-400">
              {quizResult.Skipped_Count} / {quizResult.Incorrect_Count}
            </span>
          </div>
        </div>

        {/* Detailed Question Review List */}
        <div className="space-y-5">
          <h4 className="font-extrabold text-sm text-slate-200 border-b border-slate-900 pb-2.5">
            Detailed Attempt Question Review
          </h4>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {quizResult.Answers.map((ans, idx) => {
              const isExpanded = !!expandedAnswers[idx];
              const isAnswerCorrect = ans.Is_Correct;
              const hasSkipped = ans.Selected_Option_Index === null;

              return (
                <div 
                  key={idx}
                  className={`glass-panel border rounded-2xl p-4 transition duration-200 bg-slate-905/30 ${
                    hasSkipped
                      ? 'border-slate-850 hover:border-slate-800'
                      : isAnswerCorrect
                        ? 'border-emerald-950/80 hover:border-emerald-900/50'
                        : 'border-rose-955 hover:border-rose-900/50'
                  }`}
                >
                  {/* Card Header row */}
                  <div 
                    onClick={() => toggleExplanation(idx)}
                    className="flex justify-between items-center cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-3.5 pr-2">
                      <span className={`h-6 w-6 rounded-lg flex items-center justify-center border text-[10px] font-black flex-shrink-0 ${
                        hasSkipped
                          ? 'bg-slate-950 border-slate-850 text-slate-500'
                          : isAnswerCorrect
                            ? 'bg-emerald-950/60 border-emerald-900 text-emerald-400'
                            : 'bg-rose-955 border-rose-900 text-rose-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-250 leading-relaxed truncate max-w-md md:max-w-xl">
                        {ans.Question_Text}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {hasSkipped ? (
                        <span className="text-[8px] bg-slate-950 border border-slate-900 text-slate-500 px-2 py-0.5 rounded font-extrabold uppercase">Skipped</span>
                      ) : isAnswerCorrect ? (
                        <span className="text-[8px] bg-emerald-950/60 border border-emerald-900 text-emerald-400 px-2 py-0.5 rounded font-extrabold uppercase flex items-center space-x-0.5">
                          <Check className="h-2.5 w-2.5" />
                          <span>Correct</span>
                        </span>
                      ) : (
                        <span className="text-[8px] bg-rose-955 border border-rose-900 text-rose-450 px-2 py-0.5 rounded font-extrabold uppercase flex items-center space-x-0.5">
                          <X className="h-2.5 w-2.5" />
                          <span>Incorrect</span>
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'transform rotate-185' : ''}`} />
                    </div>
                  </div>

                  {/* Accordion content */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-slate-900 text-xs font-medium space-y-3.5 animate-in fade-in duration-200">
                      <p className="text-slate-300 font-semibold leading-relaxed">
                        Q: {ans.Question_Text}
                      </p>
                      
                      {/* Options review list */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1.5">
                        {ans.Options.map((opt, oIdx) => {
                          const isSelected = ans.Selected_Option_Index === oIdx;
                          const isCorrect = ans.Correct_Option_Index === oIdx;
                          
                          let optClass = "border-slate-900 bg-slate-950/20 text-slate-500";
                          if (isCorrect) {
                            optClass = "border-emerald-900 bg-emerald-950/30 text-emerald-300 font-bold";
                          } else if (isSelected) {
                            optClass = "border-rose-900 bg-rose-950/30 text-rose-350 font-bold";
                          }
                          
                          return (
                            <div key={oIdx} className={`px-3 py-2 rounded-lg border text-[11px] leading-relaxed flex items-center space-x-2.5 ${optClass}`}>
                              <span className={`h-5 w-5 rounded text-[9px] font-black flex items-center justify-center border flex-shrink-0 ${
                                isCorrect 
                                  ? 'bg-emerald-900/40 border-emerald-700' 
                                  : isSelected
                                    ? 'bg-rose-900/40 border-rose-700'
                                    : 'bg-slate-950 border-slate-800'
                              }`}>
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation details */}
                      {ans.Explanation && (
                        <div className="p-3 bg-slate-950/50 border border-slate-900 rounded-xl leading-relaxed">
                          <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider block mb-1">AI Explanation</span>
                          <span className="text-slate-400">{ans.Explanation}</span>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Return Action */}
        <div className="flex justify-center pt-2">
          {quizResult.Is_Passed ? (
            <button
              onClick={exitQuizToPath}
              className="px-6 py-3 bg-gradient-to-r from-indigo-650 to-brand-600 hover:from-indigo-550 hover:to-brand-500 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95"
            >
              Return to Track Map
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <button
                onClick={exitQuizToPath}
                className="px-5 py-2.5 border border-slate-800 hover:border-slate-700 bg-slate-900/60 rounded-xl text-xs font-bold text-slate-450 hover:text-slate-200 transition"
              >
                Back to Path Map
              </button>
              <button
                onClick={() => handleStartLevel(activeSubLevel)}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-650 to-rose-750 hover:from-rose-550 hover:to-rose-650 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95"
              >
                Retry This Level
              </button>
            </div>
          )}
        </div>

      </div>
    );
  }

  return null;
};

export default Assessments;
