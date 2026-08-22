import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useParams } from 'react-router-dom';

const Results = () => {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [candidateId, setCandidateId] = useState('');

  useEffect(()=>{
    if (user?.Role === 'Candidate') {
      // attempt to derive candidate id from user - in this prototype we don't have mapping, so user enters id manually
    }
  },[user]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const cid = candidateId || '';
      if (!cid) return alert('Enter a candidate ID');
      const res = await axios.get(`/assessments/results/candidate/${cid}`);
      setResults(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-white">Assessment Results</h2>
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <input value={candidateId} onChange={e=>setCandidateId(e.target.value)} placeholder="Candidate ID" className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200" />
          <button onClick={fetchResults} className="px-3 py-2 bg-indigo-600 rounded text-white">View results</button>
        </div>

        <div className="space-y-3">
          {results.map(r=> (
            <div key={r.Result_ID} className="p-3 border border-slate-800 rounded-lg bg-slate-900">
              <div className="text-slate-100 font-semibold">Test {r.Test_ID} — Score: {r.Score}/{r.Max_Score} ({((r.Score/r.Max_Score)*100).toFixed(1)}%)</div>
              <div className="text-slate-400 text-sm">Completed: {new Date(r.Completed_At).toLocaleString()}</div>
              <div className="mt-2 text-slate-300">Answer summary: {Array.isArray(r.Answers) ? `${r.Answers.length} responses recorded` : 'Available'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Results;
