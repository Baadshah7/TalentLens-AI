import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, RefreshCw, AlertCircle, Edit, Save, Plus, Trash2, 
  Sparkles, CheckCircle2, ChevronRight, HelpCircle, FileJson, ArrowRightLeft
} from 'lucide-react';

const AdminAssessments = () => {
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
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch initial active domains
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

  // Fetch current questions when sub-level is selected
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

  // Trigger Claude AI Question Generation
  const handleAiGenerate = async () => {
    if (!selectedSubLevelId) return;
    setGenerating(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await axios.post(`/assessments/admin/generate-questions?sub_level_id=${selectedSubLevelId}`);
      setQuestions(res.data.Questions || []);
      setSuccess('Successfully generated 25 questions via Claude AI! Please review and modify them below before clicking Publish.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to generate questions. Verify your Claude API token in the environment.');
    } finally {
      setGenerating(false);
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

  // Submit and Publish Questions to SQLite Pool
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

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      
      {/* Title */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-5">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3 bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            <ShieldCheck className="h-7 w-7 text-indigo-400" />
            <span>Manage Candidate Assessments</span>
          </h2>
          <p className="text-sm text-slate-450">
            Author domains, generate difficulty-aware MCQs with Claude AI, review contents, and publish levels live to candidates.
          </p>
        </div>
      </div>

      {/* Selector Filters Grid */}
      <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 bg-slate-900/40 backdrop-blur-md grid grid-cols-1 md:grid-cols-3 gap-6 shadow-lg">
        
        {/* Domain Selection */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">1. Select Domain Category</label>
          {domainsLoading ? (
            <div className="h-11 bg-slate-950/40 rounded-xl border border-slate-900 flex items-center justify-center text-xs text-slate-500 space-x-2">
              <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
              <span>Loading domains...</span>
            </div>
          ) : (
            <select
              value={selectedDomainId}
              onChange={(e) => setSelectedDomainId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-slate-100 outline-none text-xs font-bold transition shadow-inner"
            >
              {domains.map(d => (
                <option key={d.Domain_ID} value={d.Domain_ID}>{d.Name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Track Selection */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">2. Select Difficulty Track</label>
          {tracksLoading ? (
            <div className="h-11 bg-slate-950/40 rounded-xl border border-slate-900 flex items-center justify-center text-xs text-slate-500 space-x-2">
              <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
              <span>Loading tracks...</span>
            </div>
          ) : (
            <select
              value={selectedTrackId}
              onChange={handleTrackChange}
              disabled={tracks.length === 0}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-slate-100 outline-none text-xs font-bold transition shadow-inner disabled:opacity-50"
            >
              {tracks.map(t => (
                <option key={t.Track_ID} value={t.Track_ID}>{t.Name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Level Selection */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">3. Select Sub-Level Node</label>
          <select
            value={selectedSubLevelId}
            onChange={(e) => setSelectedSubLevelId(e.target.value)}
            disabled={subLevels.length === 0}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-slate-100 outline-none text-xs font-bold transition shadow-inner disabled:opacity-50"
          >
            {subLevels.map(s => (
              <option key={s.Sub_Level_ID} value={s.Sub_Level_ID}>{s.Name} (25 Questions)</option>
            ))}
          </select>
        </div>

      </div>

      {/* Control Banner actions */}
      {selectedSubLevelId && (
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/40 border border-slate-900 p-5 rounded-2xl gap-4 shadow-inner">
          <div className="text-center sm:text-left">
            <h4 className="text-sm font-bold text-slate-200 flex items-center justify-center sm:justify-start">
              <span>Selected Target:</span>
              <span className="ml-2 px-2.5 py-0.5 text-[10px] font-black rounded-lg bg-indigo-950 border border-indigo-900/60 text-indigo-300">
                {activeDomain?.Name} ➔ {activeTrack?.Name} ➔ {activeSubLevel?.Name}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Current live questions in pool: <strong className="text-slate-400">{questionsLoading ? 'Checking...' : questions.length} / 25</strong>
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleAiGenerate}
              disabled={generating || questionsLoading || submitting}
              className="flex-1 sm:flex-none px-4.5 py-2.5 bg-gradient-to-r from-violet-650 to-indigo-650 hover:from-violet-550 hover:to-indigo-550 disabled:opacity-50 text-xs font-extrabold text-white rounded-xl shadow-md flex items-center justify-center space-x-2 transition duration-200 active:scale-95"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Generating via Claude...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-violet-300" />
                  <span>Generate via Claude AI</span>
                </>
              )}
            </button>
            {questions.length === 25 && (
              <button
                onClick={handlePublish}
                disabled={submitting || generating || questionsLoading}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-550 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-xs font-extrabold text-white rounded-xl shadow-md flex items-center justify-center space-x-2 transition duration-200 active:scale-95"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Publishing pool...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Publish Assessment Set</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="flex items-start space-x-3 p-4 rounded-2xl bg-rose-950/20 border border-rose-900/30 text-rose-300 text-xs animate-in fade-in duration-200 shadow-inner">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
          <span className="font-bold leading-relaxed">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start space-x-3 p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs animate-in fade-in duration-200 shadow-inner">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
          <span className="font-bold leading-relaxed">{success}</span>
        </div>
      )}

      {/* Loader for Table previews */}
      {questionsLoading ? (
        <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-600" />
          <p className="text-xs font-bold">Querying assessment question pool details...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="glass-panel border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 max-w-lg mx-auto flex flex-col items-center space-y-4">
          <div className="p-3 bg-slate-950 rounded-full border border-slate-905 text-slate-600 shadow-inner">
            <HelpCircle className="h-7 w-7" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-300">No Assessment Questions Published</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              This sub-level has no MCQs. Click **Generate via Claude AI** above to draft 25 structured questions instantly.
            </p>
          </div>
        </div>
      ) : (
        /* Questions Review Panel List */
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-extrabold text-slate-200 text-sm flex items-center space-x-2">
              <FileJson className="h-4.5 w-4.5 text-indigo-400" />
              <span>Questions Review Editor ({questions.length} total)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-950 px-2 py-0.5 border border-slate-900 rounded-md">
              JSON Format Validated
            </span>
          </div>

          <div className="space-y-6 max-h-[800px] overflow-y-auto pr-2">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="glass-panel border border-slate-850 rounded-2xl p-5 md:p-6 bg-slate-900/30 hover:border-slate-800 transition duration-200 shadow-sm relative">
                
                {/* Question Row Header */}
                <div className="flex justify-between items-center border-b border-slate-850 pb-3 mb-4">
                  <span className="text-xs font-black text-indigo-400 bg-indigo-950/60 border border-indigo-900/50 px-2.5 py-0.5 rounded-lg">
                    Question {qIdx + 1}
                  </span>
                  <div className="flex items-center space-x-2.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Correct Option Index:</label>
                    <select
                      value={q.Correct_Option_Index}
                      onChange={(e) => handleUpdateCorrectIndex(qIdx, Number(e.target.value))}
                      className="px-2 py-1 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg text-slate-100 outline-none text-xs font-bold"
                    >
                      <option value={0}>Option 1 (A)</option>
                      <option value={1}>Option 2 (B)</option>
                      <option value={2}>Option 3 (C)</option>
                      <option value={3}>Option 4 (D)</option>
                    </select>
                  </div>
                </div>

                {/* Edit Fields */}
                <div className="space-y-4 text-xs font-medium">
                  {/* Question Text */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Question Prompt</label>
                    <textarea
                      value={q.Question_Text}
                      onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-150 outline-none text-xs min-h-[60px] shadow-inner font-semibold"
                      placeholder="Enter MCQ prompt..."
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Answer Choices</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {q.Options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center space-x-2">
                          <span className={`text-[10px] font-black h-6 w-6 rounded-lg flex items-center justify-center border flex-shrink-0 ${
                            q.Correct_Option_Index === oIdx 
                              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400' 
                              : 'bg-slate-950 border-slate-850 text-slate-500'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleUpdateOption(qIdx, oIdx, e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-300 outline-none text-xs font-semibold shadow-inner"
                            placeholder={`Option ${oIdx + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Explanation</label>
                    <textarea
                      value={q.Explanation || ''}
                      onChange={(e) => handleUpdateExplanation(qIdx, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-400 outline-none text-xs min-h-[50px] shadow-inner"
                      placeholder="Optional explanation shown post-submit..."
                    />
                  </div>

                </div>

              </div>
            ))}
          </div>

          {/* Bottom Publish Block */}
          <div className="flex justify-end p-2">
            <button
              onClick={handlePublish}
              disabled={submitting || generating || questionsLoading}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-550 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-xs font-black uppercase tracking-wider text-white rounded-xl shadow-lg flex items-center justify-center space-x-2 transition duration-200 active:scale-98"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                  <span>Publishing Changes...</span>
                </>
              ) : (
                <>
                  <Save className="h-4.5 w-4.5" />
                  <span>Publish reviewed questions set live</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

    </div>
  );
};

export default AdminAssessments;
