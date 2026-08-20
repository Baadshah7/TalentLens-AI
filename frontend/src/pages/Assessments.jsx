import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Assessments = () => {
  const { user } = useAuth();
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load a default test (id=1) if available
    const load = async () => {
      try {
        const res = await axios.get('/assessments/tests/1');
        setTest(res.data);
        setAnswers(Array(res.data.Questions.length).fill(-1));
        setTimeLeft(res.data.Duration_Sec || 600);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!test) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [test]);

  const selectOption = (qIdx, optIdx) => {
    const copy = answers.slice();
    copy[qIdx] = optIdx;
    setAnswers(copy);
  };

  const handleSubmit = async () => {
    if (!test) return;
    // stop timer immediately on submit
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(0);
    setLoading(true);
    try {
      const res = await axios.post(`/assessments/tests/${test.Test_ID}/submit`, { Answers: answers });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to submit test');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s) => {
    const mm = Math.floor(s/60).toString().padStart(2,'0');
    const ss = (s%60).toString().padStart(2,'0');
    return `${mm}:${ss}`;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-white">Assessments</h2>
      {!test && <p className="text-slate-400 mt-3">No test loaded. Admins can create tests via API.</p>}
      {test && (
        <div className="mt-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-100">{test.Title}</h3>
              <div className="text-sm text-slate-400">{test.Questions.length} questions • {formatTime(test.Duration_Sec)}</div>
            </div>
            <div className="text-sm font-mono text-emerald-300">Time left: {formatTime(timeLeft)}</div>
          </div>

          <div className="mt-4 space-y-4">
            {test.Questions.map((q, qi) => (
              <div key={q.Question_ID} className="bg-slate-950/20 p-3 rounded-lg">
                <div className="text-slate-100 font-medium">{qi+1}. {q.Text}</div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {q.Options.map((opt, oi) => (
                    <button key={oi} onClick={() => selectOption(qi, oi)} className={`text-left px-3 py-2 rounded-lg border ${answers[qi]===oi ? 'border-emerald-500 bg-emerald-600/10' : 'border-slate-800'} text-slate-300`}>{opt}</button>
                  ))}
                </div>
              </div>
            ))}

            {!result && (
              <div className="flex items-center space-x-3">
                <button onClick={handleSubmit} disabled={loading || !!result} className="px-4 py-2 bg-indigo-600 rounded-lg text-white">{loading ? 'Submitting...' : 'Submit Answers'}</button>
                <button onClick={() => { setAnswers(Array(test.Questions.length).fill(-1)); }} disabled={loading || !!result} className="px-3 py-2 border border-slate-800 rounded-lg text-slate-300">Reset</button>
              </div>
            )}

            {result && (
              <div className="mt-4 bg-slate-900 border border-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-slate-100">Results</h4>
                <div className="text-slate-300 mt-2">Score: {result.Score} / {result.Max_Score} ({result.Percentage.toFixed(1)}%)</div>
                <div className="text-slate-300">Correct: {result.Correct} / {result.Total}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Assessments;
