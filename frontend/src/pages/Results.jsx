import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Award, CheckCircle, XCircle, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Results = () => {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [candidateId, setCandidateId] = useState('');
  const [searched, setSearched] = useState(false);

  // Automatically fetch candidate's own results if they are a Candidate
  useEffect(() => {
    if (user?.Role === 'Candidate') {
      const cid = user.Candidate_ID;
      setCandidateId(cid.toString());
      fetchCandidateAttempts(cid);
    }
  }, [user]);

  const fetchCandidateAttempts = async (cidToQuery) => {
    const id = cidToQuery || candidateId;
    if (!id) return;
    
    setLoading(true);
    setResults([]);
    setSearched(true);
    try {
      const res = await axios.get(`/assessments/candidate/${id}/attempts`);
      setResults(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to retrieve assessment history for this candidate.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCandidateAttempts(candidateId);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* Title */}
      <div className="border-b border-slate-900 pb-5">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3 bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            <ClipboardList className="h-7 w-7 text-indigo-400" />
            <span>Assessment Attempts Log</span>
          </h2>
          <p className="text-sm text-slate-450">
            {user?.Role === 'Candidate' 
              ? 'Review your complete attempts history and performance metrics across tracks.'
              : 'Search and inspect candidate assessment scores and performance stats.'}
          </p>
        </div>
      </div>

      {/* Recruiter Search Panel */}
      {user?.Role !== 'Candidate' && (
        <form onSubmit={handleSearch} className="glass-panel border border-slate-800/80 rounded-2xl p-5 bg-slate-900/40 backdrop-blur-md flex flex-col sm:flex-row items-center gap-4 shadow-md">
          <div className="relative flex-1 w-full">
            <span className="absolute left-3.5 top-3.5 text-slate-500">
              <Search className="h-4 w-4" />
            </span>
            <input 
              value={candidateId} 
              onChange={e => setCandidateId(e.target.value)} 
              placeholder="Enter Candidate ID (e.g. 1)" 
              className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-850 focus:border-brand-500 rounded-xl text-slate-100 outline-none text-xs font-bold transition shadow-inner"
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center space-x-1.5 active:scale-95"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <span>Lookup Attempts</span>
            )}
          </button>
        </form>
      )}

      {/* Attempts log listing */}
      {loading ? (
        <div className="glass-panel border border-slate-900 rounded-2xl p-12 text-center text-slate-500">
          <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-3 text-slate-650" />
          <p className="text-xs font-bold">Querying attempts log history...</p>
        </div>
      ) : results.length === 0 ? (
        searched && (
          <div className="text-center py-12 text-xs text-slate-500 italic border border-slate-900 rounded-2xl bg-slate-950/20 max-w-md mx-auto">
            No assessment attempts found for this candidate.
          </div>
        )
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="font-extrabold text-slate-200 text-sm px-1">Attempts Record ({results.length})</h3>
          
          <div className="grid grid-cols-1 gap-4">
            {results.map((r) => (
              <div 
                key={r.Attempt_ID} 
                className={`glass-panel border rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-905/30 ${
                  r.Is_Passed 
                    ? 'border-emerald-950/80' 
                    : 'border-slate-850'
                }`}
              >
                {/* Details Left */}
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl border flex-shrink-0 ${
                    r.Is_Passed 
                      ? 'bg-emerald-950/50 border-emerald-900 text-emerald-400' 
                      : 'bg-slate-950 border-slate-900 text-slate-500'
                  }`}>
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-150 text-sm">
                      {r.Domain_Name} — {r.Track_Name} Level {r.Level_Number}
                    </h4>
                    <div className="text-[10px] text-slate-550 mt-1 font-semibold flex flex-wrap gap-x-3 gap-y-1">
                      <span>Attempt #{r.Attempt_Number}</span>
                      <span>•</span>
                      <span>Submitted: {new Date(r.Submitted_At).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Score Right */}
                <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-900">
                  <div className="text-left md:text-right">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Score Achieved</span>
                    <span className={`text-base font-black ${r.Is_Passed ? 'text-emerald-450' : 'text-slate-400'}`}>
                      {r.Score_Percent.toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center space-x-3.5">
                    {r.Is_Passed ? (
                      <span className="text-[9px] bg-emerald-950/60 border border-emerald-900 text-emerald-450 px-2.5 py-1 rounded-xl font-extrabold uppercase tracking-wide flex items-center space-x-1 shadow-sm">
                        <CheckCircle className="h-3 w-3" />
                        <span>Passed</span>
                      </span>
                    ) : (
                      <span className="text-[9px] bg-rose-955 border border-rose-900 text-rose-300 px-2.5 py-1 rounded-xl font-extrabold uppercase tracking-wide flex items-center space-x-1 shadow-sm">
                        <XCircle className="h-3 w-3" />
                        <span>Incomplete</span>
                      </span>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Results;
