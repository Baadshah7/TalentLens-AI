import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ShieldCheck, RefreshCw, AlertCircle, Edit, Save, Plus, Trash2,
  Sparkles, CheckCircle2, ChevronDown, HelpCircle, Settings,
  BarChart3, Users, Target, TrendingUp, Layers, BookOpen,
  Brain, Code, Shield, Smartphone, Database, Scale, Zap,
  ChevronRight, Activity, CheckSquare
} from 'lucide-react';

// ── Domain icon helper ─────────────────────────────────────────────────────
const getDomainIcon = (slug, cls = 'h-5 w-5') => {
  switch (slug?.toLowerCase()) {
    case 'brain':      return <Brain      className={`${cls} text-pink-400`} />;
    case 'code':       return <Code       className={`${cls} text-sky-400`} />;
    case 'shield':     return <Shield     className={`${cls} text-emerald-400`} />;
    case 'smartphone': return <Smartphone className={`${cls} text-violet-400`} />;
    case 'database':   return <Database   className={`${cls} text-amber-400`} />;
    case 'sparkles':   return <Sparkles   className={`${cls} text-indigo-400`} />;
    case 'scale':      return <Scale      className={`${cls} text-rose-400`} />;
    default:           return <HelpCircle className={`${cls} text-slate-400`} />;
  }
};

// ── Status badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ isLive, isDraft }) => {
  if (isLive)  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-950/20 border border-emerald-900/40 text-emerald-400">Live</span>;
  if (isDraft) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-950/20 border border-amber-900/40 text-amber-400">Draft</span>;
  return        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-955 border border-red-900/30 text-red-400">Empty</span>;
};

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN CARD — shown on the Overview tab
// ═══════════════════════════════════════════════════════════════════════════
const DomainCard = ({ domain, onGoToEditor }) => {
  const livePct = domain.Total_Levels > 0 ? (domain.Levels_Live / domain.Total_Levels) * 100 : 0;

  return (
    <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-4 hover:border-slate-800 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl group-hover:border-slate-700 transition-colors">
            {getDomainIcon(domain.Icon_Slug, 'h-5 w-5')}
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-100 leading-tight">{domain.Domain_Name}</h4>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5 line-clamp-1">{domain.Description || 'Assessment domain'}</p>
          </div>
        </div>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
          domain.Is_Active
            ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
            : 'bg-slate-950 border-slate-800 text-slate-500'
        }`}>
          {domain.Is_Active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Level Health Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-bold">
          <span className="text-slate-500">Level Coverage</span>
          <span className="text-slate-300">{domain.Levels_Live} / {domain.Total_Levels} Live</span>
        </div>
        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-850">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${livePct}%`,
              background: livePct === 100
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : livePct >= 60
                ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                : livePct > 0
                ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                : 'transparent'
            }}
          />
        </div>
        {/* Mini per-level dots */}
        <div className="flex space-x-1 mt-1">
          {(domain.Levels || []).map((lv, i) => (
            <div
              key={i}
              title={`Level ${lv.Level_Number}: ${lv.Is_Live ? 'Live' : 'Empty'} (${lv.Attempt_Count} attempts)`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                lv.Is_Live ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-900">
        <div className="text-center space-y-0.5">
          <div className="flex items-center justify-center space-x-1">
            <Activity className="h-3 w-3 text-indigo-400" />
            <span className="text-xs font-black text-slate-100">{domain.Total_Attempts}</span>
          </div>
          <p className="text-[9px] text-slate-500 font-semibold">Attempts</p>
        </div>
        <div className="text-center space-y-0.5">
          <div className="flex items-center justify-center space-x-1">
            <Target className="h-3 w-3 text-emerald-400" />
            <span className="text-xs font-black text-slate-100">{domain.Overall_Pass_Rate}%</span>
          </div>
          <p className="text-[9px] text-slate-500 font-semibold">Pass Rate</p>
        </div>
        <div className="text-center space-y-0.5">
          <div className="flex items-center justify-center space-x-1">
            <Users className="h-3 w-3 text-sky-400" />
            <span className="text-xs font-black text-slate-100">{domain.Unique_Candidates}</span>
          </div>
          <p className="text-[9px] text-slate-500 font-semibold">Candidates</p>
        </div>
      </div>

      {/* Go to editor */}
      <button
        onClick={() => onGoToEditor(domain)}
        className="w-full flex items-center justify-center space-x-1.5 py-1.5 border border-slate-850 hover:border-indigo-800/60 bg-slate-950/40 hover:bg-indigo-950/20 text-slate-500 hover:text-indigo-400 rounded-xl text-[10px] font-bold transition-all duration-150"
      >
        <Edit className="h-3.5 w-3.5" />
        <span>Edit MCQs</span>
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const AdminAssessments = () => {
  // ── Tab ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'editor'

  // ── Overview states ────────────────────────────────────────────────────
  const [domainStats, setDomainStats] = useState([]);
  const [domainStatsLoading, setDomainStatsLoading] = useState(true);
  const [subLevelsStatus, setSubLevelsStatus] = useState([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showStatusSheet, setShowStatusSheet] = useState(false);

  // ── Batch Generator states ─────────────────────────────────────────────
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, text: '' });
  const [seedLoading, setSeedLoading] = useState(false);

  // ── Editor states ──────────────────────────────────────────────────────
  const [domains, setDomains] = useState([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [subLevels, setSubLevels] = useState([]);
  const [selectedSubLevelId, setSelectedSubLevelId] = useState('');
  const [questions, setQuestions] = useState([]);

  const [domainsLoading, setDomainsLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Shared feedback ────────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Fetch helpers ──────────────────────────────────────────────────────
  const fetchDomainStats = useCallback(async () => {
    try {
      setDomainStatsLoading(true);
      const res = await axios.get('/assessments/admin/domain-stats');
      setDomainStats(res.data || []);
    } catch (err) {
      console.error('Failed to load domain stats:', err);
    } finally {
      setDomainStatsLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const res = await axios.get('/assessments/admin/sub-levels-status');
      setSubLevelsStatus(res.data || []);
    } catch (err) {
      console.error('Failed to load status catalog:', err);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchDomainStats();
    fetchStatus();

    const fetchDomains = async () => {
      try {
        setDomainsLoading(true);
        const res = await axios.get('/assessments/domains');
        setDomains(res.data);
        if (res.data.length > 0) {
          setSelectedDomainId(res.data[0].Domain_ID.toString());
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load domains.');
      } finally {
        setDomainsLoading(false);
      }
    };
    fetchDomains();
  }, [fetchDomainStats, fetchStatus]);

  // ── Editor: load tracks when domain changes ────────────────────────────
  useEffect(() => {
    if (!selectedDomainId) return;
    const fetchTracks = async () => {
      try {
        setTracksLoading(true);
        setTracks([]);
        setSubLevels([]);
        setSelectedTrackId('');
        setSelectedSubLevelId('');
        setQuestions([]);
        const res = await axios.get(`/assessments/domains/${selectedDomainId}/tracks`);
        setTracks(res.data);
        if (res.data.length > 0) {
          setSelectedTrackId(res.data[0].Track_ID.toString());
          const firstSubs = res.data[0].Sub_Levels || [];
          setSubLevels(firstSubs);
          if (firstSubs.length > 0) setSelectedSubLevelId(firstSubs[0].Sub_Level_ID.toString());
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load tracks.');
      } finally {
        setTracksLoading(false);
      }
    };
    fetchTracks();
  }, [selectedDomainId]);

  // ── Editor: load questions when sub-level changes ──────────────────────
  useEffect(() => {
    if (!selectedSubLevelId) return;
    const fetchQuestions = async () => {
      try {
        setQuestionsLoading(true);
        setError('');
        setSuccess('');
        const res = await axios.get(`/assessments/admin/sub-levels/${selectedSubLevelId}/questions`);
        setQuestions(res.data.Questions || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load questions for this level.');
      } finally {
        setQuestionsLoading(false);
      }
    };
    fetchQuestions();
  }, [selectedSubLevelId]);

  // ── Editor: track selector ────────────────────────────────────────────
  const handleTrackChange = (e) => {
    const trackId = e.target.value;
    setSelectedTrackId(trackId);
    setQuestions([]);
    const found = tracks.find(t => t.Track_ID === Number(trackId));
    if (found) {
      const subs = found.Sub_Levels || [];
      setSubLevels(subs);
      setSelectedSubLevelId(subs.length > 0 ? subs[0].Sub_Level_ID.toString() : '');
    }
  };

  // ── Overview: navigate to editor for a specific domain ─────────────────
  const handleGoToEditor = (domain) => {
    const found = domains.find(d => d.Name === domain.Domain_Name);
    if (found) setSelectedDomainId(found.Domain_ID.toString());
    setActiveTab('editor');
    setError('');
    setSuccess('');
  };

  // ── Batch Generator ────────────────────────────────────────────────────
  const missingLevels = subLevelsStatus.filter(sl => sl.Question_Count < 20 && sl.Draft_Count < 20);

  const handleBatchGenerate = async () => {
    if (missingLevels.length === 0) {
      alert('All levels currently have live questions or draft reviews populated.');
      return;
    }
    if (!window.confirm(`Initiate sequential AI generation for all ${missingLevels.length} empty levels? Drafts will be created for your review.`)) return;

    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: missingLevels.length, text: 'Preparing generator pipelines...' });

    for (let i = 0; i < missingLevels.length; i++) {
      const sl = missingLevels[i];
      setBatchProgress(prev => ({
        ...prev,
        current: i + 1,
        text: `Processing: ${sl.Domain_Name} › ${sl.Track_Name} › Level ${sl.Level_Number}...`
      }));

      let attempts = 0;
      let ok = false;
      while (attempts < 3 && !ok) {
        try {
          attempts++;
          // always draft — auto_publish=false enforced
          await axios.post(`/assessments/admin/generate-questions?sub_level_id=${sl.Sub_Level_ID}&auto_publish=false`);
          ok = true;
        } catch (err) {
          console.error(`Attempt ${attempts} failed for Level ${sl.Sub_Level_ID}:`, err);
          if (attempts < 3) {
            setBatchProgress(prev => ({ ...prev, text: `Retrying (attempt ${attempts + 1}/3) in 3 s...` }));
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      }
      if (!ok) console.error(`Failed to generate Level ${sl.Sub_Level_ID} after 3 attempts.`);

      if (i < missingLevels.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    setBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0, text: 'Batch draft generation completed! Review in MCQ Editor → Publish Live.' });
    fetchStatus();
    fetchDomainStats();
  };

  const handleSeedAll = async () => {
    try {
      setSeedLoading(true);
      setError('');
      setSuccess('');
      const res = await axios.post('/assessments/admin/seed-all-questions');
      setSuccess(res.data.message || 'Successfully seeded default technical questions across all domain tracks!');
      fetchStatus();
      fetchDomainStats();
    } catch (err) {
      console.error(err);
      setError('Failed to seed default domain questions.');
    } finally {
      setSeedLoading(false);
    }
  };

  // ── Editor: AI generate draft ──────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!selectedSubLevelId) return;
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`/assessments/admin/generate-questions?sub_level_id=${selectedSubLevelId}&auto_publish=false`);
      setQuestions(res.data.Questions || []);
      setSuccess('Successfully generated 20 questions as DRAFT. Review and edit below, then click Publish Live.');
      fetchStatus();
      fetchDomainStats();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to generate questions. Verify your Claude API token.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Editor: publish ────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!selectedSubLevelId) return;
    if (questions.length < 1) {
      setError(`A level must contain at least 1 question to be published. Current count: ${questions.length}`);
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = { Questions: questions };
      const res = await axios.post(`/assessments/admin/publish-questions?sub_level_id=${selectedSubLevelId}`, payload);
      setSuccess(res.data.message || 'Assessment questions successfully published live!');
      fetchStatus();
      fetchDomainStats();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to publish questions.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Editor: question mutators ──────────────────────────────────────────
  const handleUpdateQuestionText = (idx, text) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, Question_Text: text } : q));

  const handleUpdateOption = (qIdx, oIdx, val) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.Options];
      opts[oIdx] = val;
      return { ...q, Options: opts };
    }));

  const handleUpdateCorrectIndex = (qIdx, correctIdx) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, Correct_Option_Index: correctIdx } : q));

  const handleUpdateExplanation = (qIdx, explanation) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, Explanation: explanation } : q));

  const handleAddQuestion = () =>
    setQuestions(prev => [...prev, {
      Question_Text: `Question ${prev.length + 1}: Enter technical scenario...`,
      Options: ['Option A', 'Option B', 'Option C', 'Option D'],
      Correct_Option_Index: 0,
      Explanation: 'Provide a detailed explanation for the correct answer...'
    }]);

  const handleDeleteQuestion = (idx) => {
    if (!window.confirm(`Remove Question ${idx + 1}? This won't be saved until you Publish Live.`)) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Derived editor context ─────────────────────────────────────────────
  const activeDomain   = domains.find(d => d.Domain_ID === Number(selectedDomainId));
  const activeTrack    = tracks.find(t => t.Track_ID === Number(selectedTrackId));
  const activeSubLevel = subLevels.find(s => s.Sub_Level_ID === Number(selectedSubLevelId));

  // ── Overview aggregate summary ─────────────────────────────────────────
  const totalAttempts     = domainStats.reduce((s, d) => s + d.Total_Attempts, 0);
  const totalLive         = domainStats.reduce((s, d) => s + d.Levels_Live, 0);
  const totalLevels       = domainStats.reduce((s, d) => s + d.Total_Levels, 0);
  const totalCandidates   = domainStats.reduce((s, d) => s + d.Unique_Candidates, 0);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center space-x-3">
            <ShieldCheck className="h-6 w-6 text-indigo-400" />
            <span>Manage Candidate Assessments</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Author domains, generate difficulty-aware MCQs with Claude AI, review drafts, and publish levels live to candidates.
          </p>
        </div>

        {/* ── Tab Switcher ────────────────────────────────────────── */}
        <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl p-1 gap-1 self-start sm:self-auto">
          {[
            { key: 'overview', icon: <BarChart3 className="h-3.5 w-3.5" />, label: 'Domain Overview' },
            { key: 'editor',   icon: <BookOpen  className="h-3.5 w-3.5" />, label: 'MCQ Editor' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(''); setSuccess(''); }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Global Feedback Toasts ───────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-955 border border-red-900/30 text-red-300 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-955 border border-emerald-900/30 text-emerald-300 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: DOMAIN OVERVIEW
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">

          {/* ── Aggregate Stat Strip ──────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Attempts',   value: totalAttempts,   icon: <Activity    className="h-4 w-4 text-indigo-400" /> },
              { label: 'Live Levels',      value: `${totalLive}/${totalLevels}`, icon: <CheckSquare className="h-4 w-4 text-emerald-400" /> },
              { label: 'Unique Candidates',value: totalCandidates,  icon: <Users       className="h-4 w-4 text-sky-400" /> },
              { label: 'Domains Active',   value: domainStats.filter(d => d.Is_Active).length, icon: <Layers className="h-4 w-4 text-violet-400" /> },
            ].map(s => (
              <div key={s.label} className="glass-panel border border-slate-900 rounded-xl p-4 flex items-center space-x-3">
                <div className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg flex-shrink-0">
                  {s.icon}
                </div>
                <div>
                  <p className="text-lg font-black text-slate-100 leading-tight">{domainStatsLoading ? '—' : s.value}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Domain Cards Grid ─────────────────────────────────────── */}
          {domainStatsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="glass-panel border border-slate-900 rounded-2xl p-5 h-52 animate-pulse bg-slate-950/60" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {domainStats.map(domain => (
                <DomainCard
                  key={domain.Domain_ID}
                  domain={domain}
                  onGoToEditor={handleGoToEditor}
                />
              ))}
            </div>
          )}

          {/* ── Batch AI Generator Panel ──────────────────────────────── */}
          <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-950/40 border border-indigo-900/30 text-indigo-400 rounded-xl shadow-inner">
                  <Settings className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-200">AI Batch Question Generator</h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    Bulk generate draft MCQs using rate-controlled queues
                    {!statusLoading && missingLevels.length > 0 && (
                      <span className="ml-1 text-amber-400">({missingLevels.length} levels need questions)</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                <button
                  onClick={handleSeedAll}
                  disabled={seedLoading || batchGenerating}
                  className="px-3.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs font-extrabold transition shadow-md flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{seedLoading ? 'Seeding...' : 'Auto-Populate All Domains'}</span>
                </button>

                <button
                  onClick={() => setShowStatusSheet(v => !v)}
                  className="px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <span>{showStatusSheet ? 'Hide Status Sheet' : 'Inspect Status Sheet'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showStatusSheet ? 'rotate-180' : ''}`} />
                </button>

                <button
                  disabled={batchGenerating || seedLoading || missingLevels.length === 0}
                  onClick={handleBatchGenerate}
                  className="px-4 py-1.5 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl text-xs font-extrabold transition shadow-md flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {batchGenerating ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /><span>Generating Drafts...</span></>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /><span>Generate All Missing</span></>
                  )}
                </button>
              </div>
            </div>

            {/* ── Draft-only notice ────────────────────────────────── */}
            <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-semibold border-t border-slate-900 pt-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span>All AI-generated questions are saved as <strong className="text-slate-400">Drafts</strong>. Review and edit them in the MCQ Editor tab, then click <strong className="text-slate-400">Publish Live</strong> to deploy to candidates.</span>
            </div>

            {/* ── Progress Monitor ─────────────────────────────────── */}
            {batchProgress.text && (
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                <div className="flex justify-between text-[10px] text-slate-450 font-bold">
                  <span>{batchProgress.text}</span>
                  {batchProgress.total > 0 && (
                    <span>Level {batchProgress.current} of {batchProgress.total}</span>
                  )}
                </div>
                {batchProgress.total > 0 && (
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-600 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Status Sheet Accordion ───────────────────────────── */}
            {showStatusSheet && (
              <div className="border-t border-slate-900 pt-4 animate-in slide-in-from-top-2 duration-200">
                {statusLoading ? (
                  <div className="text-center py-6 text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-650" />
                    <p className="text-[10px] font-bold">Syncing level index...</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto border border-slate-900 rounded-xl bg-slate-955/40">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                          <th className="p-3">Domain</th>
                          <th className="p-3">Track</th>
                          <th className="p-3">Level</th>
                          <th className="p-3 text-right">Questions</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subLevelsStatus.map(sl => {
                          const isLive  = sl.Question_Count >= 20;
                          const isDraft = !isLive && sl.Draft_Count >= 20;
                          return (
                            <tr key={sl.Sub_Level_ID} className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/10">
                              <td className="p-3 font-semibold text-slate-350">{sl.Domain_Name}</td>
                              <td className="p-3 text-slate-450">{sl.Track_Name}</td>
                              <td className="p-3 text-slate-450">Level {sl.Level_Number}</td>
                              <td className="p-3 text-right text-slate-400 font-bold">{sl.Question_Count}</td>
                              <td className="p-3 text-right">
                                <StatusBadge isLive={isLive} isDraft={isDraft} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: MCQ EDITOR
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'editor' && (
        <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h3 className="font-extrabold text-sm text-slate-200 flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-indigo-400" />
              <span>Single Level MCQ Writer &amp; Editor</span>
            </h3>
          </div>

          {/* ── Selectors ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Assessment Domain</label>
              {domainsLoading ? (
                <div className="h-9 w-full bg-slate-950 border border-slate-850 rounded-xl animate-pulse" />
              ) : (
                <select
                  value={selectedDomainId}
                  onChange={e => setSelectedDomainId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition font-semibold"
                >
                  {domains.map(d => (
                    <option key={d.Domain_ID} value={d.Domain_ID}>{d.Name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Difficulty Track</label>
              {tracksLoading ? (
                <div className="h-9 w-full bg-slate-950 border border-slate-850 rounded-xl animate-pulse" />
              ) : (
                <select
                  value={selectedTrackId}
                  onChange={handleTrackChange}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition font-semibold"
                >
                  {tracks.map(t => (
                    <option key={t.Track_ID} value={t.Track_ID}>{t.Name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Sub-Level Number</label>
              <select
                value={selectedSubLevelId}
                onChange={e => setSelectedSubLevelId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition font-semibold"
              >
                {subLevels.map(s => (
                  <option key={s.Sub_Level_ID} value={s.Sub_Level_ID}>{s.Name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Action Bar ───────────────────────────────────────────── */}
          <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-900 rounded-xl gap-3 flex-wrap">
            <div className="text-slate-450 font-bold text-xs">
              {activeDomain && activeTrack && activeSubLevel ? (
                <span>
                  <span className="text-slate-500">Target:</span>{' '}
                  <span className="text-indigo-400">{activeDomain.Name}</span>
                  <ChevronRight className="h-3 w-3 inline mx-0.5 text-slate-600" />
                  <span className="text-slate-300">{activeTrack.Name}</span>
                  <ChevronRight className="h-3 w-3 inline mx-0.5 text-slate-600" />
                  <span className="text-slate-300">{activeSubLevel.Name}</span>
                </span>
              ) : (
                <span className="text-slate-600">Select domain, track, and level above</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                disabled={generating || !selectedSubLevelId}
                onClick={handleAiGenerate}
                className="px-4 py-2 border border-indigo-900 bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-400 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                {generating ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /><span>Drafting questions...</span></>
                ) : (
                  <><Sparkles className="h-4 w-4" /><span>AI Generate Draft</span></>
                )}
              </button>
              <button
                disabled={submitting || questions.length === 0}
                onClick={handlePublish}
                className="px-4.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-555 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Publish Live'}
              </button>
            </div>
          </div>

          {/* ── Question Editor Workspace ─────────────────────────────── */}
          <div className="space-y-6 pt-1">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-sm text-slate-300">
                Level MCQ Items ({questions.length}/20)
              </h4>
              <button
                onClick={handleAddQuestion}
                className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            {questionsLoading ? (
              <div className="text-center py-12 text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-650" />
                <p className="text-xs font-bold">Synchronizing question bank...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 border border-slate-900/60 rounded-xl bg-slate-950/20 text-slate-500">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">No questions found for this level.</p>
                <p className="text-[10px] text-slate-555 mt-0.5">Use <strong className="text-slate-400">AI Generate Draft</strong> above, or run the Batch Generator from the Domain Overview tab.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-4 shadow-sm animate-in fade-in duration-200">

                    {/* Question Text */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Question {qIdx + 1}</label>
                        <div className="flex items-center space-x-3">
                          <span className="text-[9px] text-indigo-400 font-bold">Multiple Choice (4 options)</span>
                          <button
                            onClick={() => handleDeleteQuestion(qIdx)}
                            title="Remove this question"
                            className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all duration-150"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={q.Question_Text}
                        onChange={e => handleUpdateQuestionText(qIdx, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition font-medium"
                      />
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.Options.map((opt, oIdx) => (
                        <div key={oIdx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] text-slate-550 uppercase tracking-wider font-bold">
                              Option {String.fromCharCode(65 + oIdx)}
                            </label>
                            <label className="flex items-center space-x-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`correct-radio-${qIdx}`}
                                checked={q.Correct_Option_Index === oIdx}
                                onChange={() => handleUpdateCorrectIndex(qIdx, oIdx)}
                                className="rounded-full border-slate-800 bg-slate-900 text-indigo-500 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                              />
                              <span className="text-[9px] text-slate-500 font-bold select-none">Correct</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => handleUpdateOption(qIdx, oIdx, e.target.value)}
                            className={`w-full bg-slate-950 border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition font-medium ${
                              q.Correct_Option_Index === oIdx ? 'border-indigo-500/40 bg-indigo-950/10' : 'border-slate-850'
                            }`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Explanation */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[9px] text-slate-550 uppercase tracking-wider font-bold block">Explanation</label>
                      <textarea
                        value={q.Explanation || ''}
                        onChange={e => handleUpdateExplanation(qIdx, e.target.value)}
                        placeholder="Add key insights for candidate review sessions..."
                        className="w-full bg-slate-950 border border-slate-855 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 outline-none transition min-h-[60px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssessments;
