import React, { useState } from 'react';
import axios from 'axios';

const AdminAssessments = () => {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(600);
  const [questions, setQuestions] = useState([{ Text: '', Options: ['', ''], Correct_Index: 0, Points: 1 }]);
  const [loading, setLoading] = useState(false);

  const addQuestion = () => setQuestions(prev => [...prev, { Text: '', Options: ['', ''], Correct_Index: 0, Points: 1 }]);
  const removeQuestion = (i) => setQuestions(prev => prev.filter((_,idx) => idx!==i));
  const updateQuestion = (i, field, val) => {
    const copy = questions.slice();
    copy[i][field] = val;
    setQuestions(copy);
  };
  const updateOption = (qIdx, optIdx, val) => {
    const copy = questions.slice();
    copy[qIdx].Options[optIdx] = val;
    setQuestions(copy);
  };
  const addOption = (qIdx) => {
    const copy = questions.slice();
    copy[qIdx].Options.push('');
    setQuestions(copy);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const payload = { Title: title, Duration_Sec: duration, Questions: questions.map(q => ({ Text: q.Text, Options: q.Options, Correct_Index: q.Correct_Index, Points: q.Points })) };
      const res = await axios.post('/assessments/tests/', payload);
      alert('Created test id ' + res.data.Test_ID);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-white">Create Assessment</h2>
      <div className="mt-4 space-y-4">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Test Title" className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200" />
        <div className="flex items-center space-x-2">
          <label className="text-slate-300">Duration (minutes)</label>
          <input type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="w-32 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200" />
        </div>

        {questions.map((q,qi)=> (
          <div key={qi} className="p-3 border border-slate-800 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <div className="text-slate-200 font-medium">Question {qi+1}</div>
              <div>
                <button onClick={()=>addOption(qi)} className="mr-2 px-2 py-1 text-xs border rounded">Add Option</button>
                <button onClick={()=>removeQuestion(qi)} disabled={questions.length===1} className="px-2 py-1 text-xs border rounded">Remove</button>
              </div>
            </div>
            <input value={q.Text} onChange={e=>updateQuestion(qi,'Text',e.target.value)} placeholder="Question text" className="w-full p-2 rounded bg-slate-900 border border-slate-800 text-slate-200 mb-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {q.Options.map((opt,oi)=> (
                <div key={oi}>
                  <input value={opt} onChange={e=>updateOption(qi,oi,e.target.value)} placeholder={`Option ${oi+1}`} className="w-full p-2 rounded bg-slate-900 border border-slate-800 text-slate-200" />
                  <div className="text-xs text-slate-400">Correct answer:
                    <input type="radio" name={`correct-${qi}`} checked={q.Correct_Index===oi} onChange={()=>updateQuestion(qi,'Correct_Index',oi)} className="ml-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <button onClick={addQuestion} className="px-4 py-2 bg-slate-800 border rounded mr-2">Add Question</button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 bg-indigo-600 rounded text-white">{loading ? 'Creating...' : 'Create Test'}</button>
        </div>
      </div>
    </div>
  );
};

export default AdminAssessments;
