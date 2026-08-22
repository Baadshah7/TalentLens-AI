import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Clock3, History, Mic, MicOff, RotateCcw, Sparkles, Trophy, XCircle } from 'lucide-react';

const starterQuestions = [
  'Tell me about a time you led a project.',
  'Describe a difficult problem you solved at work.',
  'Why are you interested in this role?',
  'Tell me about a time you received difficult feedback.'
];

const starParts = [
  { key: 'situation', label: 'Situation', hints: ['when', 'context', 'background', 'team', 'project'] },
  { key: 'task', label: 'Task', hints: ['responsible', 'goal', 'needed to', 'task', 'objective'] },
  { key: 'action', label: 'Action', hints: ['i ', 'led', 'built', 'created', 'decided', 'implemented'] },
  { key: 'result', label: 'Result', hints: ['result', 'increased', 'reduced', 'improved', 'learned', '%', 'success'] }
];

const readHistory = () => {
  try { return JSON.parse(localStorage.getItem('talentlens_coach_history') || '[]'); } catch { return []; }
};

const CandidateCoach = () => {
  const [mode, setMode] = useState('practice');
  const [question, setQuestion] = useState(starterQuestions[0]);
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState(readHistory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [listening, setListening] = useState(false);

  const wordCount = sampleAnswer.trim() ? sampleAnswer.trim().split(/\s+/).length : 0;
  const starScore = useMemo(() => starParts.reduce((score, part) => (
    score + (part.hints.some((hint) => sampleAnswer.toLowerCase().includes(hint)) ? 1 : 0)
  ), 0), [sampleAnswer]);
  const simulationQuestions = starterQuestions.slice(0, 3);

  useEffect(() => {
    localStorage.setItem('talentlens_coach_history', JSON.stringify(history.slice(0, 12)));
  }, [history]);

  const submit = async () => {
    if (!question.trim() || !sampleAnswer.trim()) {
      setError('Add a question and an answer before requesting feedback.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/chatbot/generate/coach', { question: question.trim(), sample_answer: sampleAnswer.trim() });
      const result = { ...res.data, feedback: res.data.feedback || [], suggestions: res.data.suggestions || [] };
      setFeedback(result);
      setHistory((items) => [{ id: Date.now(), question, answer: sampleAnswer, score: starScore, createdAt: new Date().toISOString(), result }, ...items]);
    } catch (err) {
      console.error(err);
      setError('Feedback could not be loaded. Check the API connection and try again.');
    } finally { setLoading(false); }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Voice input is not supported in this browser.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (event) => setSampleAnswer((current) => `${current} ${event.results[0][0].transcript}`.trim());
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError('Voice input stopped. Please try again.'); };
    recognition.start();
    setListening(true);
  };

  const nextSimulationQuestion = () => {
    const nextIndex = (simulationIndex + 1) % simulationQuestions.length;
    setSimulationIndex(nextIndex);
    setQuestion(simulationQuestions[nextIndex]);
    setSampleAnswer('');
    setFeedback(null);
    setError('');
  };

  const loadHistoryItem = (item) => { setQuestion(item.question); setSampleAnswer(item.answer); setFeedback(item.result); setMode('practice'); };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400"><Sparkles className="h-4 w-4" /> Practice studio</div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Candidate Coach</h2>
          <p className="mt-1 text-sm text-slate-400">Build sharper answers with focused, explainable feedback.</p>
        </div>
        <div className="flex rounded-xl border border-slate-800 bg-slate-900/70 p-1" role="tablist">
          <button onClick={() => setMode('practice')} className={`rounded-lg px-3 py-2 text-sm ${mode === 'practice' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Practice</button>
          <button onClick={() => setMode('simulation')} className={`rounded-lg px-3 py-2 text-sm ${mode === 'simulation' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Simulation</button>
          <button onClick={() => setMode('history')} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${mode === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><History className="h-4 w-4" /> History</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-300"><XCircle className="h-4 w-4" />{error}</div>}

      {mode === 'history' ? (
        <section className="glass-panel rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-white">Recent practice</h3><span className="text-xs text-slate-500">{history.length} saved</span></div>
          {history.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Your completed practice answers will appear here.</p> : <div className="space-y-3">{history.map((item) => <button key={item.id} onClick={() => loadHistoryItem(item)} className="w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-left transition hover:border-indigo-500/60"><div className="flex items-start justify-between gap-3"><span className="text-sm text-slate-200">{item.question}</span><span className="whitespace-nowrap text-xs text-indigo-300">{item.score}/4 STAR</span></div><p className="mt-2 line-clamp-2 text-xs text-slate-500">{item.answer}</p></button>)}</div>}
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <section className="glass-panel rounded-2xl p-5">
            {mode === 'simulation' && <div className="mb-5 flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3"><span className="text-sm text-indigo-200">Question {simulationIndex + 1} of {simulationQuestions.length}</span><span className="flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-4 w-4" /> Untimed</span></div>}
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Question to practice</label><div className="flex gap-2"><input className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Tell me about a time you led a project" />{mode === 'practice' && <button title="Use a starter question" onClick={() => setQuestion(starterQuestions[Math.floor(Math.random() * starterQuestions.length)])} className="rounded-lg border border-slate-800 px-3 text-slate-400 hover:text-white"><RotateCcw className="h-4 w-4" /></button>}</div></div>
            <div className="mt-5 space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium text-slate-300">Your answer</label><span className="text-xs text-slate-500">{wordCount} words</span></div><textarea className="min-h-[190px] w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" value={sampleAnswer} onChange={(e) => setSampleAnswer(e.target.value)} placeholder="Use a specific example. Include what you did and what changed." /><button onClick={listening ? () => setListening(false) : startListening} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">{listening ? <MicOff className="h-4 w-4 text-rose-400" /> : <Mic className="h-4 w-4" />}{listening ? 'Listening...' : 'Use voice input'}</button></div>
            <div className="mt-5 flex flex-wrap gap-3"><button onClick={submit} disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Checking...' : 'Get feedback'}</button>{mode === 'simulation' && <button onClick={nextSimulationQuestion} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500">Next question</button>}</div>
          </section>

          <aside className="space-y-6">
            <section className="glass-card rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-white">STAR checklist</h3><span className="text-lg font-bold text-indigo-300">{starScore}/4</span></div><div className="space-y-3">{starParts.map((part) => { const complete = part.hints.some((hint) => sampleAnswer.toLowerCase().includes(hint)); return <div key={part.key} className="flex items-center gap-3 text-sm"><span className={complete ? 'text-emerald-400' : 'text-slate-600'}>{complete ? <CheckCircle2 className="h-4 w-4" /> : <span className="block h-4 w-4 rounded-full border border-current" />}</span><span className={complete ? 'text-slate-200' : 'text-slate-500'}>{part.label}</span></div>; })}</div></section>
            {feedback && <section className="glass-card rounded-2xl p-5"><div className="mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /><h3 className="font-semibold text-white">Coach notes</h3></div>{feedback.feedback.length ? <ul className="space-y-2 text-sm text-slate-300">{feedback.feedback.map((item, index) => <li key={index} className="flex gap-2"><span className="text-rose-400">-</span>{item}</li>)}</ul> : <p className="text-sm text-emerald-300">No critical issues found.</p>}<h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Next improvements</h4><ul className="mt-2 space-y-2 text-sm text-slate-300">{feedback.suggestions.map((item, index) => <li key={index} className="flex gap-2"><span className="text-indigo-400">+</span>{item}</li>)}</ul></section>}
          </aside>
        </div>
      )}
    </div>
  );
};

export default CandidateCoach;
