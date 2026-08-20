import React, { useState } from 'react';
import axios from 'axios';

const CandidateCoach = () => {
  const [question, setQuestion] = useState('');
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!question) return alert('Please enter a question to practice.');
    setLoading(true);
    try {
      const res = await axios.post('/chatbot/generate/coach', { question, sample_answer: sampleAnswer });
      setFeedback(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to get feedback.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-white">Candidate Coach</h2>
      <p className="text-sm text-slate-400">Practice interview questions and get quick, heuristic feedback.</p>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Question to practice</label>
        <input className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Tell me about a time you led a project" />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Your sample answer (optional)</label>
        <textarea className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg min-h-[120px]" value={sampleAnswer} onChange={(e) => setSampleAnswer(e.target.value)} />
      </div>

      <div>
        <button onClick={submit} disabled={loading} className="px-4 py-2 bg-indigo-600 rounded-lg text-white">{loading ? 'Checking...' : 'Get Feedback'}</button>
      </div>

      {feedback && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mt-4">
          <h4 className="font-bold text-slate-100">Feedback</h4>
          {feedback.feedback && feedback.feedback.length > 0 ? (
            <ul className="list-disc pl-5 text-slate-300 mt-2">
              {feedback.feedback.map((f, idx) => <li key={idx}>{f}</li>)}
            </ul>
          ) : (
            <p className="text-slate-300 mt-2">No critical feedback — good job! See suggestions below.</p>
          )}

          <h5 className="mt-3 font-semibold text-slate-200">Suggestions</h5>
          <ul className="list-disc pl-5 text-slate-300 mt-2">
            {feedback.suggestions.map((s, idx) => <li key={idx}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CandidateCoach;
