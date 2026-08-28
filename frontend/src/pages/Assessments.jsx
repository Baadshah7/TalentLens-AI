import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Brain, Code, Shield, Smartphone, Database, Sparkles, Scale,
  Lock, CheckCircle2, ChevronLeft, ChevronRight, ArrowRight, Play, RefreshCw, 
  HelpCircle, Timer, Award, Flame, ClipboardList, Check, X, XCircle, ChevronDown, 
  CheckSquare, Trophy, Star, TrendingUp, BarChart3, Target
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
  
  // Domain completion scorecard
  const [showDomainScorecard, setShowDomainScorecard] = useState(false);
  
  // Quiz states
  const [answers, setAnswers] = useState(Array(20).fill(-1));
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const [quizResult, setQuizResult] = useState(null);
  
  // Shuffle map ref
  const shuffleMapRef = useRef(null);
  
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

  const renderBreadcrumbs = () => (
    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mb-6 font-bold select-none border-b border-slate-900 pb-3">
      <span 
        className="hover:text-slate-300 cursor-pointer transition duration-150"
        onClick={() => {
          if (!activeAttempt || window.confirm("Exit active assessment? Progress will be lost.")) {
            setActiveDomain(null); setActiveSubLevel(null); setActiveAttempt(null);
            setQuizResult(null); setShowDomainScorecard(false);
          }
        }}
      >
        Domains
      </span>
      {activeDomain && (
        <>
          <ChevronRight className="h-3 w-3 text-slate-700" />
          <span 
            className={`transition duration-150 ${(activeSubLevel || showDomainScorecard) ? 'hover:text-slate-300 cursor-pointer' : 'text-indigo-400 font-extrabold'}`}
            onClick={() => {
              if (activeSubLevel || showDomainScorecard) {
                if (!activeAttempt || window.confirm("Exit active assessment? Progress will be lost.")) {
                  setActiveSubLevel(null); setActiveAttempt(null); setQuizResult(null); setShowDomainScorecard(false);
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
          <span className="text-indigo-400 font-extrabold">Level {activeSubLevel.Level_Number}</span>
        </>
      )}
      {showDomainScorecard && (
        <>
          <ChevronRight className="h-3 w-3 text-slate-700" />
          <span className="text-amber-400 font-extrabold">Domain Scorecard</span>
        </>
      )}
    </div>
  );

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

  useEffect(() => { loadDomainList(); }, []);

  const handleSelectDomain = async (domain) => {
    setActiveDomain(domain);
    setShowDomainScorecard(false);
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

  const refreshTrackMap = async () => {
    if (!activeDomain) return null;
    try {
      const res = await axios.get(`/assessments/domains/${activeDomain.Domain_ID}/tracks`);
      setTracks(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleStartLevel = async (subLevel) => {
    setActiveSubLevel(subLevel);
    setQuestionsLoading(true);
    setError('');
    setQuizResult(null);
    setCurrentQuestionIdx(0);
    setExpandedAnswers({});
    setShowConfetti(false);
    setShowDomainScorecard(false);
    shuffleMapRef.current = null;
    
    try {
      const attemptRes = await axios.post(`/assessments/sub-levels/${subLevel.Sub_Level_ID}/attempts`);
      setActiveAttempt(attemptRes.data);
      
      const questionsRes = await axios.get(`/assessments/sub-levels/${subLevel.Sub_Level_ID}/questions`);
      const rawQuestions = questionsRes.data || [];

      // Client-side shuffle options
      const shuffledQuestions = rawQuestions.map(q => {
        const originalOptions = [...q.Options];
        const originalIndices = originalOptions.map((_, i) => i);
        for (let i = originalIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [originalIndices[i], originalIndices[j]] = [originalIndices[j], originalIndices[i]];
        }
        const shuffledOptions = originalIndices.map(i => originalOptions[i]);
        const displayCorrectIdx = originalIndices.indexOf(q.Correct_Option_Index);
        return { ...q, Options: shuffledOptions, _originalIndices: originalIndices, _displayCorrectIdx: displayCorrectIdx };
      });

      // Shuffle question order
      const questionOrderIndices = shuffledQuestions.map((_, i) => i);
      for (let i = questionOrderIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questionOrderIndices[i], questionOrderIndices[j]] = [questionOrderIndices[j], questionOrderIndices[i]];
      }
      const reorderedQuestions = questionOrderIndices.map(i => shuffledQuestions[i]);

      shuffleMapRef.current = reorderedQuestions.map(q => ({
        Question_ID: q.Question_ID,
        originalIndices: q._originalIndices
      }));

      setQuestions(reorderedQuestions);
      setAnswers(Array(reorderedQuestions.length).fill(-1));
      setTimeLeft((subLevel.Time_Limit_Minutes || 20) * 60);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start quiz attempt.');
      setActiveSubLevel(null);
    } finally {
      setQuestionsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSubLevel || quizResult) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handleAutoSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeSubLevel, quizResult]);

  const selectOption = (qIdx, optIdx) => {
    const copy = [...answers]; copy[qIdx] = optIdx; setAnswers(copy);
  };

  const handleAutoSubmit = () => handleSubmit(true);

  const handleSubmit = async (isAuto = false) => {
    if (!activeAttempt || !activeSubLevel) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSubmittingQuiz(true);
    setError('');
    
    const formattedAnswers = questions.map((q, idx) => {
      const displaySelectedIdx = answers[idx];
      let originalSelectedIdx = null;
      if (displaySelectedIdx !== -1 && displaySelectedIdx !== null && displaySelectedIdx !== undefined) {
        const map = shuffleMapRef.current ? shuffleMapRef.current[idx] : null;
        if (map && map.originalIndices && displaySelectedIdx >= 0 && displaySelectedIdx < map.originalIndices.length) {
          originalSelectedIdx = map.originalIndices[displaySelectedIdx];
        } else {
          originalSelectedIdx = displaySelectedIdx;
        }
      }
      return { Question_ID: q.Question_ID, Selected_Option_Index: originalSelectedIdx };
    });
    
    const totalTimeLimit = (activeSubLevel.Time_Limit_Minutes || 20) * 60;
    const timeTaken = totalTimeLimit - timeLeft;

    try {
      const res = await axios.post(`/assessments/attempts/${activeAttempt.Attempt_ID}/submit`, {
        Answers: formattedAnswers, Time_Taken_Seconds: timeTaken
      });
      try {
        const detailRes = await axios.get(`/assessments/attempts/${activeAttempt.Attempt_ID}/results`);
        setQuizResult(detailRes.data);
      } catch (detErr) {
        setQuizResult(res.data);
      }
      if (res.data.Is_Passed) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
      }
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

  const toggleExplanation = (idx) => setExpandedAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));

  const formatTime = (s) => {
    const mm = Math.floor(s/60).toString().padStart(2,'0');
    const ss = (s%60).toString().padStart(2,'0');
    return `${mm}:${ss}`;
  };

  const handleReturnToMap = async () => {
    setActiveSubLevel(null);
    setActiveAttempt(null);
    setQuizResult(null);
    setQuestions([]);
    const updatedTracks = await refreshTrackMap();
    if (updatedTracks && updatedTracks.length > 0) {
      const allSubLevels = updatedTracks.flatMap(t => t.Sub_Levels || []);
      if (allSubLevels.length === 5 && allSubLevels.every(sl => sl.Is_Completed)) {
        setShowDomainScorecard(true);
      }
    }
  };

  const exitQuizToPath = () => handleReturnToMap();

  // ==========================================
  // Layout 1: Domain Selection Dashboard
  // ==========================================
  if (!activeDomain) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {renderBreadcrumbs()}
        
        {progressSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <div className="flex items-center space-x-3.5 px-4 py-2 border-r border-slate-800 last:border-0">
              <div className="p-3 bg-indigo-950/60 rounded-xl border border-indigo-900/40 text-indigo-400"><Award className="h-5 w-5" /></div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Score XP</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.xp} <span className="text-xs text-indigo-400">XP</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-3.5 px-4 py-2 md:border-r border-slate-800 last:border-0">
              <div className="p-3 bg-amber-950/60 rounded-xl border border-amber-900/40 text-amber-400 animate-pulse"><Flame className="h-5 w-5" /></div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Daily Streak</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.streak} <span className="text-xs text-amber-400">days 🔥</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-3.5 px-4 py-2 border-r border-slate-800 last:border-0">
              <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-900/40 text-emerald-400"><CheckCircle2 className="h-5 w-5" /></div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Passed Levels</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.completed_levels} <span className="text-xs text-emerald-400">levels</span></span>
              </div>
            </div>
            <div className="flex items-center space-x-3.5 px-4 py-2 last:border-0">
              <div className="p-3 bg-violet-950/60 rounded-xl border border-violet-900/40 text-violet-400"><ClipboardList className="h-5 w-5" /></div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Quiz Attempts</span>
                <span className="text-lg font-black text-slate-100">{progressSummary.total_attempts} <span className="text-xs text-violet-400">times</span></span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <h3 className="text-xl font-extrabold text-white">Select Assessment Domain</h3>
          <p className="text-xs text-slate-400">Choose a specialized technological category to test and expand your capabilities. Each domain has 5 levels with 20 questions each.</p>
        </div>

        {domainsLoading ? (
          <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-650" />
            <p className="text-xs font-bold">Retrieving evaluation domain structures...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {domains.map(d => {
              const levelScores = d.Level_Scores || [];
              const completedCount = levelScores.filter(ls => ls.is_completed).length;
              const allDone = completedCount === 5;
              return (
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
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-950 border border-slate-900 text-slate-400">
                          5 Levels • 20Q each
                        </span>
                        {allDone && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center gap-1">
                            <Trophy className="h-2.5 w-2.5" /> Mastered
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-100 text-sm group-hover:text-indigo-400 transition-colors">{d.Name}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{d.Description}</p>
                    </div>
                    {/* 5 level progress dots */}
                    {levelScores.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {levelScores.map(ls => (
                          <div 
                            key={ls.level}
                            title={`Level ${ls.level}: ${ls.is_completed ? ls.best_score.toFixed(0)+'%' : ls.is_unlocked ? 'Unlocked' : 'Locked'}`}
                            className={`h-2 flex-1 rounded-full transition-all ${
                              ls.is_completed ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : ls.is_unlocked ? 'bg-indigo-600/60 animate-pulse' 
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-900">
                    <div className="flex justify-between text-[10px] text-slate-450 font-bold mb-1">
                      <span>Overall Completion</span>
                      <span className="text-indigo-400">{d.Completion_Percentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900 shadow-inner">
                      <div className="h-full bg-gradient-to-r from-indigo-600 to-brand-500 rounded-full" style={{ width: `${d.Completion_Percentage}%` }}></div>
                    </div>
                    {completedCount > 0 && (
                      <p className="text-[9px] text-slate-500 mt-1">{completedCount}/5 levels passed</p>
                    )}
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
  // Layout 2b: Domain Completion Scorecard
  // ==========================================
  if (activeDomain && showDomainScorecard) {
    const coreTrack = tracks[0];
    const subLevels = coreTrack?.Sub_Levels || [];
    const totalCorrect = subLevels.reduce((sum, sl) => sum + Math.round(((sl.Best_Score || 0) / 100) * (sl.Question_Count || 20)), 0);
    const totalQuestions = subLevels.reduce((sum, sl) => sum + (sl.Question_Count || 20), 0);
    const totalPercent = totalQuestions > 0 ? (totalCorrect / totalQuestions * 100) : 0;
    const avgScore = subLevels.length > 0 ? subLevels.reduce((sum, sl) => sum + (sl.Best_Score || 0), 0) / subLevels.length : 0;

    const getRankBadge = (pct) => {
      if (pct >= 90) return { label: 'Expert', color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/60' };
      if (pct >= 75) return { label: 'Advanced', color: 'text-indigo-400', bg: 'bg-indigo-950/40 border-indigo-800/60' };
      if (pct >= 60) return { label: 'Intermediate', color: 'text-sky-400', bg: 'bg-sky-950/40 border-sky-800/60' };
      return { label: 'Beginner', color: 'text-slate-400', bg: 'bg-slate-900/40 border-slate-800' };
    };
    const rank = getRankBadge(totalPercent);

    return (
      <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl mx-auto">
        {renderBreadcrumbs()}

        {/* Trophy Header */}
        <div className="glass-panel border border-amber-800/40 rounded-3xl p-8 text-center bg-amber-950/10 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative space-y-4">
            <div className="inline-flex p-5 bg-amber-950 border border-amber-800/60 rounded-full text-amber-400 shadow-inner animate-bounce">
              <Trophy className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-amber-400 bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Domain Mastered! 🏆
              </h2>
              <p className="text-sm text-slate-300 font-semibold">{activeDomain.Name}</p>
              <p className="text-xs text-slate-500">You have completed all 5 levels — here is your full domain report</p>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-black text-sm ${rank.bg} ${rank.color}`}>
              <Star className="h-4 w-4" /><span>{rank.label} Level</span>
            </div>
          </div>
        </div>

        {/* Overall Score Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-5 bg-slate-900/40 border border-slate-900 rounded-2xl text-center shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Total Score</span>
            <span className={`text-2xl font-black mt-2 block ${totalPercent >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalPercent.toFixed(0)}%</span>
            <span className="text-[10px] text-slate-500 font-medium">{totalCorrect}/{totalQuestions} correct</span>
          </div>
          <div className="p-5 bg-slate-900/40 border border-slate-900 rounded-2xl text-center shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Avg Per Level</span>
            <span className="text-2xl font-black mt-2 block text-indigo-400">{avgScore.toFixed(0)}%</span>
            <span className="text-[10px] text-slate-500 font-medium">across 5 levels</span>
          </div>
          <div className="p-5 bg-slate-900/40 border border-slate-900 rounded-2xl text-center shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Levels Passed</span>
            <span className="text-2xl font-black mt-2 block text-emerald-400">5/5</span>
            <span className="text-[10px] text-slate-500 font-medium">all cleared ✓</span>
          </div>
        </div>

        {/* Per-Level Score Breakdown */}
        <div className="space-y-3">
          <h4 className="font-extrabold text-sm text-slate-200 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            Score Breakdown — Each Level (20 Questions per Level)
          </h4>
          <div className="space-y-2.5">
            {subLevels.map((sl) => {
              const correctCount = Math.round(((sl.Best_Score || 0) / 100) * (sl.Question_Count || 20));
              const scoreColor = (sl.Best_Score || 0) >= 80 ? 'text-emerald-400' : (sl.Best_Score || 0) >= 60 ? 'text-indigo-400' : 'text-amber-400';
              const barColor = (sl.Best_Score || 0) >= 80 ? 'from-emerald-600 to-teal-500' : (sl.Best_Score || 0) >= 60 ? 'from-indigo-600 to-brand-500' : 'from-amber-600 to-orange-500';
              return (
                <div key={sl.Sub_Level_ID} className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black border bg-emerald-950/60 border-emerald-900 text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200">Level {sl.Level_Number}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{sl.Name?.replace(`Level ${sl.Level_Number}: `, '') || ''}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-black ${scoreColor}`}>{(sl.Best_Score || 0).toFixed(0)}%</span>
                      <span className="text-[10px] text-slate-500 block">{correctCount}/{sl.Question_Count || 20} correct</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                    <div className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700`} style={{ width: `${sl.Best_Score || 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Score Banner */}
        <div className="p-5 bg-gradient-to-r from-indigo-950/40 to-brand-950/40 border border-indigo-900/40 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-900/40 rounded-xl border border-indigo-800/40 text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block">Domain Final Score</span>
              <span className="text-[10px] text-slate-500">{totalCorrect} out of {totalQuestions} total questions answered correctly</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-black ${totalPercent >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalCorrect}<span className="text-lg text-slate-500">/{totalQuestions}</span>
            </span>
            <span className="text-[10px] text-slate-500 block">{totalPercent.toFixed(1)}% overall</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => { setActiveDomain(null); setShowDomainScorecard(false); setTracks([]); }}
            className="px-6 py-3 border border-slate-800 hover:border-slate-700 bg-slate-900/60 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition"
          >
            Back to Domains
          </button>
          <button
            onClick={() => setShowDomainScorecard(false)}
            className="px-6 py-3 bg-gradient-to-r from-indigo-650 to-brand-600 hover:from-indigo-550 hover:to-brand-500 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Practice Again
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // Layout 2: Level Path Map (5 Nodes)
  // ==========================================
  if (activeDomain && !activeSubLevel) {
    const allSubLevels = tracks.flatMap(t => t.Sub_Levels || []);
    const completedCount = allSubLevels.filter(sl => sl.Is_Completed).length;
    const allCompleted = completedCount === 5 && allSubLevels.length === 5;
    const domTotalCorrect = allSubLevels.reduce((sum, sl) => sum + Math.round(((sl.Best_Score || 0) / 100) * (sl.Question_Count || 20)), 0);
    const domTotalQ = allSubLevels.reduce((sum, sl) => sum + (sl.Question_Count || 20), 0);
    const domTotalPct = domTotalQ > 0 ? (domTotalCorrect / domTotalQ * 100) : 0;

    return (
      <div className="space-y-8 animate-in fade-in duration-300 max-w-xl mx-auto">
        {renderBreadcrumbs()}
        
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <button onClick={() => setActiveDomain(null)} className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition font-bold">
            <ChevronLeft className="h-4 w-4" /><span>Return to Categories</span>
          </button>
          <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-1.5">
            {getDomainIcon(activeDomain.Icon_Slug, "h-4.5 w-4.5")}
            <span>{activeDomain.Name} Path</span>
          </h3>
        </div>

        {tracksLoading ? (
          <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-650" />
            <p className="text-xs font-bold">Structuring level map nodes...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Domain Progress header */}
            {completedCount > 0 && (
              <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-950/50 rounded-xl border border-indigo-900/40 text-indigo-400"><Target className="h-4 w-4" /></div>
                  <div>
                    <span className="text-xs font-bold text-slate-200">{completedCount}/5 Levels Completed</span>
                    {domTotalQ > 0 && <span className="text-[10px] text-slate-500 block">{domTotalCorrect}/{domTotalQ} questions correct ({domTotalPct.toFixed(0)}%)</span>}
                  </div>
                </div>
                {allCompleted && (
                  <button
                    onClick={() => setShowDomainScorecard(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/50 border border-amber-800/60 text-amber-400 rounded-xl text-[10px] font-black hover:bg-amber-900/50 transition"
                  >
                    <Trophy className="h-3 w-3" /> View Scorecard
                  </button>
                )}
              </div>
            )}

            {/* 5-Level Nodes Path */}
            {tracks.map((t) => (
              <div key={t.Track_ID} className="relative bg-slate-900/10 border border-slate-900 rounded-2xl p-5 space-y-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                  <div>
                    <h4 className="font-extrabold text-sm tracking-wide text-slate-200 uppercase">
                      {activeDomain.Name} — 5 Level Assessment
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Complete levels sequentially • 20 questions each • 60% needed to pass</p>
                  </div>
                  {allCompleted && (
                    <span className="flex items-center space-x-1 text-[10px] bg-amber-950/40 border border-amber-800/60 text-amber-400 px-2 py-0.5 rounded-lg font-bold">
                      <Trophy className="h-3 w-3" /><span>Mastered</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center py-6 relative space-y-8">
                  {t.Sub_Levels.map((sl, slIdx) => {
                    const offsets = ["translate-x-0","translate-x-8 md:translate-x-14","translate-x-16 md:translate-x-28","translate-x-8 md:translate-x-14","translate-x-0"];
                    const offsetClass = offsets[slIdx % offsets.length];
                    return (
                      <div key={sl.Sub_Level_ID} className={`transform ${offsetClass} transition-transform duration-300 flex flex-col items-center relative group z-10`}>
                        {slIdx < t.Sub_Levels.length - 1 && (
                          <div className="absolute top-14 left-7 w-0.5 h-12 bg-slate-800 pointer-events-none z-0"></div>
                        )}
                        <button
                          disabled={!sl.Is_Unlocked}
                          onClick={() => handleStartLevel(sl)}
                          className={`h-14 w-14 rounded-full flex items-center justify-center font-bold text-xs shadow-md border transition-all duration-300 active:scale-95 ${
                            sl.Is_Completed
                              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                              : sl.Is_Unlocked
                                ? 'bg-gradient-to-tr from-indigo-650 to-brand-600 border-indigo-500 text-white animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                                : 'bg-slate-950 border-slate-850 text-slate-600 cursor-not-allowed'
                          }`}
                          title={sl.Is_Unlocked ? `Start Level ${sl.Level_Number} (20 questions)` : 'Level Locked — Complete previous level first'}
                        >
                          {sl.Is_Completed ? <Check className="h-5 w-5 stroke-[3px]" /> : sl.Is_Unlocked ? <span className="font-black text-sm">L{sl.Level_Number}</span> : <Lock className="h-3.5 w-3.5" />}
                        </button>
                        <div className="mt-2 text-center max-w-[90px]">
                          <span className="text-[10px] font-bold text-slate-350 block">Level {sl.Level_Number}</span>
                          {sl.Is_Completed ? (
                            <>
                              <span className="block text-[9px] text-emerald-400 font-extrabold">Best: {(sl.Best_Score || 0).toFixed(0)}%</span>
                              <span className="block text-[9px] text-slate-500">{Math.round(((sl.Best_Score || 0) / 100) * (sl.Question_Count || 20))}/{sl.Question_Count || 20} correct</span>
                            </>
                          ) : sl.Is_Unlocked ? (
                            <span className="block text-[9px] text-indigo-400 font-extrabold uppercase animate-pulse">Start →</span>
                          ) : (
                            <span className="block text-[9px] text-slate-600 font-medium">🔒 Locked</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-900 grid grid-cols-3 gap-3 text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="h-3 w-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                    <span className="text-[9px] text-slate-500 font-bold">Completed</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="h-3 w-3 rounded-full bg-gradient-to-r from-indigo-600 to-brand-500" />
                    <span className="text-[9px] text-slate-500 font-bold">Available</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="h-3 w-3 rounded-full bg-slate-800 border border-slate-700" />
                    <span className="text-[9px] text-slate-500 font-bold">Locked</span>
                  </div>
                </div>
              </div>
            ))}

            {allCompleted && (
              <div className="p-5 bg-amber-950/10 border border-amber-800/40 rounded-2xl text-center space-y-3">
                <Trophy className="h-8 w-8 text-amber-400 mx-auto" />
                <h4 className="font-black text-sm text-amber-400">All 5 Levels Completed! 🎉</h4>
                <p className="text-xs text-slate-400">View your full domain scorecard with per-level scores and total results.</p>
                <button
                  onClick={() => setShowDomainScorecard(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-550 hover:from-amber-500 hover:to-yellow-500 text-slate-900 font-black rounded-xl text-xs transition active:scale-95 shadow-md"
                >
                  View Domain Scorecard →
                </button>
              </div>
            )}
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
    const answeredCount = answers.filter(a => a !== -1).length;
    
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
        {renderBreadcrumbs()}
        
        <div className="glass-panel border border-slate-900 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center bg-slate-900/40 backdrop-blur-md gap-3 shadow-md">
          <div className="flex items-center space-x-3 text-center md:text-left">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-900">
              {getDomainIcon(activeDomain.Icon_Slug, "h-5 w-5")}
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">{activeDomain.Name} — Level {activeSubLevel.Level_Number} of 5</h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Attempt #{activeAttempt.Attempt_Number} • {questions.length} questions • Pass: {activeSubLevel.Pass_Threshold_Percent?.toFixed(0) || 60}%
                {' '}({Math.ceil(((activeSubLevel.Pass_Threshold_Percent || 60) / 100) * (questions.length || 20))}/{questions.length || 20} correct needed)
              </p>
            </div>
          </div>
          <div className={`px-4 py-2 border rounded-xl flex items-center space-x-2 font-mono text-sm font-bold shadow-inner ${
            timeLeft < 120 ? 'border-rose-900/50 bg-rose-950/20 text-rose-400 animate-pulse' : 'border-slate-800 bg-slate-950/40 text-indigo-400'
          }`}>
            <Timer className="h-4.5 w-4.5 text-current" />
            <span>Time Left: {formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-bold">
            <span>Question {currentQuestionIdx + 1} of {questions.length} • {answeredCount} answered</span>
            <span>{questions.length > 0 ? (((currentQuestionIdx + 1) / questions.length) * 100).toFixed(0) : 0}% Through</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900 shadow-inner">
            <div className="h-full bg-gradient-to-r from-indigo-650 to-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${questions.length > 0 ? ((currentQuestionIdx + 1) / questions.length) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {questionsLoading ? (
              <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500 bg-slate-900/40">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-650" />
                <p className="text-xs font-bold">Loading level questions pool...</p>
              </div>
            ) : currentQ ? (
              <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 bg-slate-900/40 backdrop-blur-md shadow-lg space-y-5 animate-in fade-in slide-in-from-left-2 duration-300">
                <h4 className="text-sm font-extrabold text-slate-100 leading-relaxed">
                  {currentQuestionIdx + 1}. {currentQ.Question_Text}
                </h4>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  {currentQ.Options.map((opt, oIdx) => {
                    const isSelected = answers[currentQuestionIdx] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => selectOption(currentQuestionIdx, oIdx)}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border text-xs font-bold transition-all duration-200 active:scale-[0.99] flex items-center justify-between shadow-sm ${
                          isSelected ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-inner' : 'border-slate-800 hover:border-slate-700 bg-slate-950/20 text-slate-350 hover:text-slate-150'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5 pr-2">
                          <span className={`h-6 w-6 rounded-lg flex items-center justify-center border font-black flex-shrink-0 ${
                            isSelected ? 'bg-indigo-600/20 border-indigo-400 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}>{String.fromCharCode(65 + oIdx)}</span>
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

            <div className="flex justify-between items-center text-xs">
              <button
                onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIdx === 0}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900/60 disabled:opacity-30 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition disabled:active:scale-100"
              >
                Previous Question
              </button>
              {currentQuestionIdx < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
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
                  {submittingQuiz ? (<><RefreshCw className="h-3.5 w-3.5 animate-spin" /><span>Evaluating...</span></>) : (<><span>Submit Answers</span><CheckCircle2 className="h-3.5 w-3.5" /></>)}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 backdrop-blur-md shadow-lg space-y-4">
              <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-850 pb-2">
                Navigator ({answeredCount}/{questions.length} answered)
              </h4>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: questions.length || 20 }).map((_, idx) => {
                  const isCurrent = currentQuestionIdx === idx;
                  const isAnswered = answers[idx] !== undefined && answers[idx] !== -1;
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentQuestionIdx(idx)}
                      className={`h-8 w-full rounded-lg flex items-center justify-center font-bold text-[10px] transition duration-200 active:scale-90 ${
                        isCurrent ? 'border-2 border-indigo-500 bg-indigo-950/50 text-indigo-300 font-black' : isAnswered ? 'bg-slate-900 border border-slate-800 text-slate-100' : 'bg-slate-950/40 border border-slate-905 text-slate-500 hover:border-slate-800'
                      }`}
                    >{idx + 1}</button>
                  );
                })}
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-850 text-[9px] text-slate-500 font-bold">
                <span className="flex items-center space-x-1"><span className="h-2 w-2 rounded bg-slate-900 border border-slate-800"></span><span>Answered</span></span>
                <span className="flex items-center space-x-1"><span className="h-2 w-2 rounded bg-slate-950/40 border border-slate-905"></span><span>Skipped</span></span>
                <span className="flex items-center space-x-1"><span className="h-2 w-2 rounded border-2 border-indigo-500 bg-indigo-950/50"></span><span>Current</span></span>
              </div>
            </div>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submittingQuiz}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-bold transition shadow-sm active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <span>Submit Assessment ({answeredCount}/{questions.length})</span>
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
    const isLastLevel = activeSubLevel?.Level_Number === 5;
    
    return (
      <div className="space-y-8 animate-in fade-in duration-300 max-w-3xl mx-auto relative">
        {renderBreadcrumbs()}
        
        {showConfetti && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
            {Array.from({ length: 40 }).map((_, idx) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 3;
              const duration = 2 + Math.random() * 3;
              const colors = ["bg-indigo-500","bg-emerald-500","bg-pink-500","bg-amber-400","bg-sky-400"];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              return (
                <div key={idx} className={`absolute top-[-20px] w-2.5 h-2.5 rounded-full ${randomColor} animate-confetti`}
                  style={{ left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }}></div>
              );
            })}
          </div>
        )}

        {/* Pass/Fail Banner */}
        <div className={`glass-panel border rounded-2xl p-8 text-center shadow-xl relative overflow-hidden ${
          quizResult.Is_Passed ? 'border-emerald-500/25 bg-emerald-950/10' : 'border-rose-900/30 bg-rose-950/10'
        }`}>
          {quizResult.Is_Passed ? (
            <div className="space-y-4">
              <div className="inline-flex p-4 bg-emerald-950 border border-emerald-900 rounded-full text-emerald-400 shadow-inner animate-bounce">
                <Award className="h-9 w-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-emerald-400">Level {activeSubLevel?.Level_Number} Passed! 🎉</h3>
                {isLastLevel ? (
                  <p className="text-xs text-amber-400 font-semibold">🏆 You have completed ALL 5 levels of {activeDomain?.Name}! View your domain scorecard below.</p>
                ) : (
                  <p className="text-xs text-slate-400">Level {(activeSubLevel?.Level_Number || 0) + 1} is now unlocked on your path map.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="inline-flex p-4 bg-rose-950 border border-rose-900 rounded-full text-rose-400 shadow-inner">
                <XCircle className="h-9 w-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-rose-400">Level {activeSubLevel?.Level_Number} — Not Passed</h3>
                <p className="text-xs text-slate-450">Review the explanations below and retry to unlock the next level.</p>
              </div>
            </div>
          )}
        </div>

        {/* Score Metrics */}
        <div className="grid grid-cols-3 gap-5 text-center">
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Score Achieved</span>
            <span className={`text-xl font-black mt-1 block ${quizResult.Is_Passed ? 'text-emerald-400' : 'text-rose-400'}`}>{quizResult.Score_Percent.toFixed(0)}%</span>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Questions Correct</span>
            <span className="text-xl font-black mt-1 block text-slate-200">{quizResult.Correct_Count} / {totalQ}</span>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-inner">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Skipped / Wrong</span>
            <span className="text-xl font-black mt-1 block text-slate-400">{quizResult.Skipped_Count} / {quizResult.Incorrect_Count}</span>
          </div>
        </div>

        {/* Level score bar (if passed) */}
        {quizResult.Is_Passed && activeSubLevel && (
          <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl">
            <div className="flex justify-between text-[10px] text-slate-500 font-bold mb-2">
              <span>Level {activeSubLevel.Level_Number} Score</span>
              <span className="text-emerald-400">{quizResult.Score_Percent.toFixed(0)}% ({quizResult.Correct_Count}/{totalQ})</span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: `${quizResult.Score_Percent}%` }} />
            </div>
            {activeSubLevel.Level_Number < 5 && (
              <p className="text-[9px] text-indigo-400 font-bold mt-1.5">→ Level {activeSubLevel.Level_Number + 1} is now unlocked!</p>
            )}
          </div>
        )}

        {/* Detailed Question Review */}
        <div className="space-y-5">
          <h4 className="font-extrabold text-sm text-slate-200 border-b border-slate-900 pb-2.5">
            Question Review ({quizResult.Answers?.length || 0} questions)
          </h4>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {(quizResult.Answers || []).map((ans, idx) => {
              const isExpanded = !!expandedAnswers[idx];
              const isAnswerCorrect = ans.Is_Correct;
              const hasSkipped = ans.Selected_Option_Index === null;
              return (
                <div key={idx} className={`glass-panel border rounded-2xl p-4 transition duration-200 bg-slate-905/30 ${
                  hasSkipped ? 'border-slate-850 hover:border-slate-800' : isAnswerCorrect ? 'border-emerald-950/80 hover:border-emerald-900/50' : 'border-rose-955 hover:border-rose-900/50'
                }`}>
                  <div onClick={() => toggleExplanation(idx)} className="flex justify-between items-center cursor-pointer select-none">
                    <div className="flex items-center space-x-3.5 pr-2">
                      <span className={`h-6 w-6 rounded-lg flex items-center justify-center border text-[10px] font-black flex-shrink-0 ${
                        hasSkipped ? 'bg-slate-950 border-slate-850 text-slate-500' : isAnswerCorrect ? 'bg-emerald-950/60 border-emerald-900 text-emerald-400' : 'bg-rose-955 border-rose-900 text-rose-400'
                      }`}>{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-250 leading-relaxed truncate max-w-md md:max-w-xl">{ans.Question_Text}</span>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {hasSkipped ? (
                        <span className="text-[8px] bg-slate-950 border border-slate-900 text-slate-500 px-2 py-0.5 rounded font-extrabold uppercase">Skipped</span>
                      ) : isAnswerCorrect ? (
                        <span className="text-[8px] bg-emerald-950/60 border border-emerald-900 text-emerald-400 px-2 py-0.5 rounded font-extrabold uppercase flex items-center space-x-0.5">
                          <Check className="h-2.5 w-2.5" /><span>Correct</span>
                        </span>
                      ) : (
                        <span className="text-[8px] bg-rose-955 border border-rose-900 text-rose-450 px-2 py-0.5 rounded font-extrabold uppercase flex items-center space-x-0.5">
                          <X className="h-2.5 w-2.5" /><span>Incorrect</span>
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-slate-900 text-xs font-medium space-y-3.5 animate-in fade-in duration-200">
                      <p className="text-slate-300 font-semibold leading-relaxed">Q: {ans.Question_Text}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1.5">
                        {ans.Options.map((opt, oIdx) => {
                          const isSelected = ans.Selected_Option_Index === oIdx;
                          const isCorrect = ans.Correct_Option_Index === oIdx;
                          let optClass = "border-slate-900 bg-slate-950/20 text-slate-500";
                          if (isCorrect) optClass = "border-emerald-900 bg-emerald-950/30 text-emerald-300 font-bold";
                          else if (isSelected) optClass = "border-rose-900 bg-rose-950/30 text-rose-350 font-bold";
                          return (
                            <div key={oIdx} className={`px-3 py-2 rounded-lg border text-[11px] leading-relaxed flex items-center space-x-2.5 ${optClass}`}>
                              <span className={`h-5 w-5 rounded text-[9px] font-black flex items-center justify-center border flex-shrink-0 ${
                                isCorrect ? 'bg-emerald-900/40 border-emerald-700' : isSelected ? 'bg-rose-900/40 border-rose-700' : 'bg-slate-950 border-slate-800'
                              }`}>{String.fromCharCode(65 + oIdx)}</span>
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                      {ans.Explanation && (
                        <div className="p-3 bg-slate-950/50 border border-slate-900 rounded-xl leading-relaxed">
                          <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider block mb-1">Explanation</span>
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

        {/* Footer Action Buttons */}
        <div className="flex justify-center pt-2">
          {quizResult.Is_Passed ? (
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={() => { setActiveSubLevel(null); setActiveAttempt(null); setQuizResult(null); setQuestions([]); refreshTrackMap(); }}
                className="px-5 py-2.5 border border-slate-800 hover:border-slate-700 bg-slate-900/60 rounded-xl text-xs font-bold text-slate-450 hover:text-slate-200 transition"
              >
                Back to Path Map
              </button>
              {isLastLevel ? (
                <button
                  onClick={exitQuizToPath}
                  className="px-6 py-3 bg-gradient-to-r from-amber-600 to-yellow-550 hover:from-amber-500 hover:to-yellow-500 text-slate-900 font-black rounded-xl text-xs shadow-md transition active:scale-95 flex items-center gap-2"
                >
                  <Trophy className="h-4 w-4" /> View Domain Scorecard 🏆
                </button>
              ) : (
                <button
                  onClick={exitQuizToPath}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-650 to-brand-600 hover:from-indigo-550 hover:to-brand-500 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-2"
                >
                  Continue to Level {(activeSubLevel?.Level_Number || 0) + 1} →
                </button>
              )}
            </div>
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
