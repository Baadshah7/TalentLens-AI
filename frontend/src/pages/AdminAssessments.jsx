import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, RefreshCw, AlertCircle, Edit, Save, Plus, Trash2, 
  Sparkles, CheckCircle2, ChevronRight, ChevronDown, HelpCircle, FileJson, ArrowRightLeft, Settings, CheckSquare
} from 'lucide-react';

const AdminAssessments = () => {
  // Single-Level Editor States
  const [domains, setDomains] = useState([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [subLevels, setSubLevels] = useState([]);
  const [selectedSubLevelId, setSelectedSubLevelId] = useState('');
  const [questions, setQuestions] = useState([]);
  
  // Loading states
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Batch AI Generator States
  const [subLevelsStatus, setSubLevelsStatus] = useState([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, text: '' });
  const [autoPublish, setAutoPublish] = useState(false);
  const [showBatchConsole, setShowBatchConsole] = useState(false);

  // Fetch initial active domains & sub-levels status mapping
  const fetchStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await axios.get('/assessments/admin/sub-levels-status');
      setSubLevelsStatus(res.data || []);
    } catch (err) {
      console.error('Failed to load status catalog:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
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
    fetchStatus();
  }, []);

  // Fetch tracks and sub-levels when domain changes
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
          const firstTrackSubLevels = res.data[0].Sub_Levels || [];
          setSubLevels(firstTrackSubLevels);
          if (firstTrackSubLevels.length > 0) {
            setSelectedSubLevelId(firstTrackSubLevels[0].Sub_Level_ID.toString());
          }
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

  // Handle track selector change
  const handleTrackChange = (e) => {
    const trackId = e.target.value;
    setSelectedTrackId(trackId);
    setQuestions([]);
    const foundTrack = tracks.find(t => t.Track_ID === Number(trackId));
    if (foundTrack) {
      const trackSubLevels = foundTrack.Sub_Levels || [];
      setSubLevels(trackSubLevels);
      if (trackSubLevels.length > 0) {
        setSelectedSubLevelId(trackSubLevels[0].Sub_Level_ID.toString());
      } else {
        setSelectedSubLevelId('');
      }
    }
  };

  // Fetch current questions when sub-level is selected (Drafts checked first!)
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
        setError('Failed to load published questions for this level.');
      } finally {
        setQuestionsLoading(false);
      }
    };
    fetchQuestions();
  }, [selectedSubLevelId]);

  // Trigger individual level AI Question Generation
  const handleAiGenerate = async () => {
    if (!selectedSubLevelId) return;
    setGenerating(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await axios.post(`/assessments/admin/generate-questions?sub_level_id=${selectedSubLevelId}&auto_publish=false`);
      setQuestions(res.data.Questions || []);
      setSuccess('Successfully generated 25 questions as DRAFT! Please review/edit below and click Publish Live to deploy.');
      fetchStatus();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to generate questions. Verify your Claude API token in the environment.');
    } finally {
      setGenerating(false);
    }
  };

  // Sequential rate-controlled batch generation loop with retries
  const handleBatchGenerate = async () => {
    const missing = subLevelsStatus.filter(sl => sl.Question_Count < 25 && sl.Draft_Count < 25);
    if (missing.length === 0) {
      alert("All levels currently have live questions or draft reviews populated.");
      return;
    }

    if (!window.confirm(`Initiate sequential AI generation for all ${missing.length} empty levels? This will run rate-controlled requests.`)) {
      return;
    }

    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: missing.length, text: 'Preparing generator pipelines...' });

    for (let i = 0; i < missing.length; i++) {
      const sl = missing[i];
      setBatchProgress(prev => ({
        ...prev,
        current: i + 1,
        text: `Processing: ${sl.Domain_Name} (${sl.Track_Name} Level ${sl.Level_Number})...`
      }));

      let attempts = 0;
      let success = false;
      while (attempts < 3 && !success) {
        try {
          attempts++;
          await axios.post(`/assessments/admin/generate-questions?sub_level_id=${sl.Sub_Level_ID}&auto_publish=${autoPublish}`);
          success = true;
        } catch (err) {
          console.error(`Attempt ${attempts} failed for Level ${sl.Sub_Level_ID}:`, err);
          if (attempts < 3) {
            setBatchProgress(prev => ({ ...prev, text: `Retrying level (attempt ${attempts + 1}/3) in 3s...` }));
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      }

      if (!success) {
        console.error(`Failed to generate Level ${sl.Sub_Level_ID} after 3 attempts.`);
      }

      // 2-second rate-limiting throttle between consecutive levels
      if (i < missing.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0, text: 'Batch AI questions generation successfully completed!' });
    fetchStatus();
    
    // Refresh editor view
    if (selectedSubLevelId) {
      const current = selectedSubLevelId;
      setSelectedSubLevelId('');
      setTimeout(() => setSelectedSubLevelId(current), 50);
    }
  };

  // Inline question editing helpers
  const handleUpdateQuestionText = (index, text) => {
    setQuestions(prev => prev.map((q, idx) => idx === index ? { ...q, Question_Text: text } : q));
  };

  const handleUpdateOption = (qIdx, optIdx, val) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIdx) {
        const updatedOpts = [...q.Options];
        updatedOpts[optIdx] = val;
        return { ...q, Options: updatedOpts };
      }
      return q;
    }));
  };

  const handleUpdateCorrectIndex = (qIdx, correctIdx) => {
    setQuestions(prev => prev.map((q, idx) => idx === qIdx ? { ...q, Correct_Option_Index: correctIdx } : q));
  };

  const handleUpdateExplanation = (qIdx, explanation) => {
    setQuestions(prev => prev.map((q, idx) => idx === qIdx ? { ...q, Explanation: explanation } : q));
  };

  // Submit and Publish Questions to SQLite Pool (Sets Is_Published=True)
  const handlePublish = async () => {
    if (!selectedSubLevelId) return;
    if (questions.length !== 25) {
      setError(`A level must contain exactly 25 questions to be published. Current count: ${questions.length}`);
      return;
    }
    
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      const payload = { Questions: questions };
      const res = await axios.post(`/assessments/admin/publish-questions?sub_level_id=${selectedSubLevelId}`, payload);
      setSuccess(res.data.message || 'Assessment questions successfully published live to candidates.');
      fetchStatus();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to publish questions.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeDomain = domains.find(d => d.Domain_ID === Number(selectedDomainId));
  const activeTrack = tracks.find(t => t.Track_ID === Number(selectedTrackId));
  const activeSubLevel = subLevels.find(s => s.Sub_Level_ID === Number(selectedSubLevelId));

  const missingLevels = subLevelsStatus.filter(sl => sl.Question_Count < 25 && sl.Draft_Count < 25);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      
      {/* Title */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center space-x-3">
            <ShieldCheck className="h-6.5 w-6.5 text-indigo-400" />
            <span>Manage Candidate Assessments</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Author domains, generate difficulty-aware MCQs with Claude AI, review drafts, and publish levels live to candidates.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-955 border border-red-900/30 text-red-300 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="h-4.5 w-4.5 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-955 border border-emerald-900/30 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-450 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ==========================================
          BATCH AI GENERATOR CONSOLE
          ========================================== */}
      <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-950/40 border border-indigo-900/30 text-indigo-400 rounded-xl shadow-inner">
              <Settings className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-200">AI Batch Question Generator</h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                Bulk generate structured levels using rate-controlled queues ({missingLevels.length} missing).
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowBatchConsole(!showBatchConsole)}
              className="px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
            >
              <span>{showBatchConsole ? 'Hide Status Sheet' : 'Inspect Status Sheet'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showBatchConsole ? 'rotate-180' : ''}`} />
            </button>
            <button
              disabled={batchGenerating || missingLevels.length === 0}
              onClick={handleBatchGenerate}
              className="px-4 py-1.5 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl text-xs font-extrabold transition shadow-md flex items-center space-x-1.5 disabled:opacity-50"
            >
              {batchGenerating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Generating Batch...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate All Missing</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Batch configuration option */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-900">
          <input
            type="checkbox"
            id="autoPublishCheck"
            checked={autoPublish}
            onChange={(e) => setAutoPublish(e.target.checked)}
            className="rounded border-slate-850 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
          />
          <label htmlFor="autoPublishCheck" className="text-[10px] font-bold text-slate-400 cursor-pointer select-none">
            Auto-Publish generated questions (skip review, deploy live immediately)
          </label>
        </div>

        {/* Progress monitor */}
        {batchProgress.text && (
          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
            <div className="flex justify-between text-[10px] text-slate-450 font-bold">
              <span>{batchProgress.text}</span>
              {batchProgress.total > 0 && (
                <span>Level {batchProgress.current} of {batchProgress.total}</span>
              )}
            </div>
            {batchProgress.total > 0 && (
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-brand-600 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        )}

        {/* Status Sheet Accordion */}
        {showBatchConsole && (
          <div className="border-t border-slate-900 pt-4 animate-in slide-in-from-top-2 duration-200">
            {statusLoading ? (
              <div className="text-center py-6 text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-650" />
                <p className="text-[10px] font-bold">Syncing level index...</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border border-slate-900 rounded-xl bg-slate-955/40">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-500 font-bold">
                      <th className="p-3">Domain</th>
                      <th className="p-3">Track</th>
                      <th className="p-3">Level</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subLevelsStatus.map((sl) => {
                      const isLive = sl.Question_Count >= 25;
                      const isDraft = !isLive && sl.Draft_Count >= 25;
                      
                      return (
                        <tr key={sl.Sub_Level_ID} className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/10">
                          <td className="p-3 font-semibold text-slate-350">{sl.Domain_Name}</td>
                          <td className="p-3 text-slate-450">{sl.Track_Name}</td>
                          <td className="p-3 text-slate-450">Level {sl.Level_Number}</td>
                          <td className="p-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              isLive
                                ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400'
                                : isDraft
                                  ? 'bg-amber-950/20 border-amber-900/40 text-amber-400'
                                  : 'bg-red-955 border-red-900/30 text-red-400'
                            }`}>
                              {isLive ? 'Live' : isDraft ? 'Draft Review' : 'Empty'}
                            </span>
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

      {/* ==========================================
          SINGLE LEVEL MCQ WRITER / EDITOR
          ========================================== */}
      <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-6">
        <h3 className="font-extrabold text-sm text-slate-205 border-b border-slate-900 pb-2">Single Level MCQ Writer & Editor</h3>
        
        {/* Selector selectors row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Assessment Domain</label>
            {domainsLoading ? (
              <div className="h-9 w-full bg-slate-950 border border-slate-850 rounded-xl animate-pulse"></div>
            ) : (
              <select
                value={selectedDomainId}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition font-semibold"
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
              <div className="h-9 w-full bg-slate-950 border border-slate-850 rounded-xl animate-pulse"></div>
            ) : (
              <select
                value={selectedTrackId}
                onChange={handleTrackChange}
                className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition font-semibold"
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
              onChange={(e) => setSelectedSubLevelId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition font-semibold"
            >
              {subLevels.map(s => (
                <option key={s.Sub_Level_ID} value={s.Sub_Level_ID}>{s.Name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate / Action Buttons */}
        <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-900 rounded-xl gap-3 flex-wrap">
          <div className="text-slate-450 font-bold text-xs">
            {activeDomain && activeTrack && activeSubLevel ? (
              <span>Target: {activeDomain.Name} &gt; {activeTrack.Name} &gt; {activeSubLevel.Name}</span>
            ) : (
              <span>Select targets above</span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              disabled={generating || !selectedSubLevelId}
              onClick={handleAiGenerate}
              className="px-4 py-2 border border-indigo-900 bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-400 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Drafting questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>AI Generate Draft</span>
                </>
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

        {/* Question editor workspace */}
        <div className="space-y-6 pt-3">
          <div className="flex justify-between items-center"><h4 className="font-extrabold text-sm text-slate-300">Level MCQ Items ({questions.length}/25)</h4></div>
          {questionsLoading ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-650" />
              <p className="text-xs font-bold">Synchronizing question bank...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 border border-slate-900/60 rounded-xl bg-slate-950/20 text-slate-500">
              <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-700" />
              <p className="text-xs font-semibold">No questions found for this level.</p>
              <p className="text-[10px] text-slate-555 mt-0.5">Click "AI Generate Draft" or "Generate All Missing" to populate this bank.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="p-5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-4 shadow-sm animate-in fade-in duration-200">
                  
                  {/* Question Text */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Question {qIdx + 1}</label>
                      <span className="text-[9px] text-indigo-400 font-bold">Multiple Choice (4 options)</span>
                    </div>
                    <input
                      type="text"
                      value={q.Question_Text}
                      onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition font-medium"
                    />
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.Options.map((opt, oIdx) => (
                      <div key={oIdx} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] text-slate-550 uppercase tracking-wider font-bold">Option {String.fromCharCode(65 + oIdx)}</label>
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`correct-radio-${qIdx}`}
                              checked={q.Correct_Option_Index === oIdx}
                              onChange={() => handleUpdateCorrectIndex(qIdx, oIdx)}
                              className="rounded-full border-slate-800 bg-slate-900 text-indigo-500 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                            />
                            <span className="text-[9px] text-slate-500 font-bold select-none">Correct Option</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleUpdateOption(qIdx, oIdx, e.target.value)}
                          className={`w-full bg-slate-950 border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none transition font-medium ${
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
                      onChange={(e) => handleUpdateExplanation(qIdx, e.target.value)}
                      placeholder="Add key insights details for candidate review sessions..."
                      className="w-full bg-slate-950 border border-slate-855 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 outline-none transition min-h-[60px]"
                    />
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default AdminAssessments;
