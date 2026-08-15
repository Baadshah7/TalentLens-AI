import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, XCircle, Award, Briefcase, FileText, Scale } from 'lucide-react';

const CandidateCompare = () => {
  const [searchParams] = useSearchParams();
  const [candidates, setCandidates] = useState([]);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const candidateIds = searchParams.get('ids') ? searchParams.get('ids').split(',') : [];
  const jobId = searchParams.get('jobId');

  useEffect(() => {
    const fetchComparisonData = async () => {
      if (candidateIds.length === 0 || !jobId) {
        setError('No candidates or job specified for comparison.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch job description
        const jobRes = await axios.get(`/jobs/${jobId}`);
        setJob(jobRes.data);

        // Fetch details of all candidates in parallel
        const detailPromises = candidateIds.map(id => axios.get(`/candidates/${id}/detail`));
        const results = await Promise.all(detailPromises);
        setCandidates(results.map(r => r.data));

        setError('');
      } catch (err) {
        console.error(err);
        setError('Failed to fetch candidate comparison profiles.');
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonData();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 text-slate-400 text-sm">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Generating side-by-side comparison...</span>
      </div>
    );
  }

  if (error || candidates.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/upload" className="inline-flex items-center space-x-2 text-sm text-brand-400 hover:text-brand-300">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to uploads</span>
        </Link>
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-300 text-sm flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error || 'No candidates found to display.'}</span>
        </div>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-950/40 border-emerald-900';
    if (score >= 50) return 'text-amber-400 bg-amber-950/40 border-amber-900';
    return 'text-red-400 bg-red-950/40 border-red-900';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <Link to={`/upload?jobId=${jobId}`} className="inline-flex items-center space-x-2 text-sm text-brand-400 hover:text-brand-300 mb-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Candidates List</span>
          </Link>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Scale className="h-5 w-5 text-indigo-400" />
            <span>Candidate Comparison Matrix</span>
          </h2>
          <p className="text-xs text-slate-400">
            Comparing {candidates.length} candidates for job: <span className="font-semibold text-indigo-300">{job?.Job_Title}</span>
          </p>
        </div>
      </div>

      {/* Grid Comparison Matrix Table */}
      <div className="glass-panel border border-slate-800/80 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40">
                <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider w-[200px]">Criteria</th>
                {candidates.map((cand) => (
                  <th key={cand.Candidate_ID} className="p-4 font-bold text-slate-100 border-l border-slate-800/60 min-w-[220px]">
                    <div className="space-y-1">
                      <div className="text-sm font-extrabold text-slate-100">{cand.Name}</div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                        ID: #{cand.Candidate_ID}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              
              {/* Row: Overall Score */}
              <tr className="border-b border-slate-800/40 hover:bg-slate-900/10">
                <td className="p-4 font-bold text-slate-300 bg-slate-900/10">Overall Match</td>
                {candidates.map((cand) => {
                  const score = cand.screening_results?.[0]?.Overall_Score ?? 0;
                  const label = cand.screening_results?.[0]?.Explanation?.recommendation || 'Low Match';
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60 bg-slate-900/10">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex px-2 py-1 border rounded-lg text-sm font-extrabold ${getScoreColor(score)}`}>
                          {score}%
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{label}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Row: Required Skills Score */}
              <tr className="border-b border-slate-800/40 hover:bg-slate-900/10">
                <td className="p-4 font-semibold text-slate-300">Required Skills Fit</td>
                {candidates.map((cand) => {
                  const score = cand.screening_results?.[0]?.Skill_Score ?? 0;
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60 font-bold text-slate-200">
                      {score}%
                    </td>
                  );
                })}
              </tr>

              {/* Row: Experience Score */}
              <tr className="border-b border-slate-800/40 hover:bg-slate-900/10">
                <td className="p-4 font-semibold text-slate-300">Experience Score</td>
                {candidates.map((cand) => {
                  const score = cand.screening_results?.[0]?.Experience_Score ?? 0;
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60 font-bold text-slate-200">
                      {score}%
                    </td>
                  );
                })}
              </tr>

              {/* Row: Education Match */}
              <tr className="border-b border-slate-800/40 hover:bg-slate-900/10">
                <td className="p-4 font-semibold text-slate-300">Education Alignment</td>
                {candidates.map((cand) => {
                  const score = cand.screening_results?.[0]?.Education_Score ?? 0;
                  const deg = cand.educations?.[0]?.Degree || 'Unknown';
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60 text-slate-200">
                      <div className="font-bold">{score}%</div>
                      <div className="text-[10px] text-slate-400">{deg}</div>
                    </td>
                  );
                })}
              </tr>

              {/* Row: Projects Match */}
              <tr className="border-b border-slate-800/40 hover:bg-slate-900/10">
                <td className="p-4 font-semibold text-slate-300">Projects Similarity</td>
                {candidates.map((cand) => {
                  const score = cand.screening_results?.[0]?.Project_Score ?? 0;
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60 font-bold text-slate-200">
                      {score}%
                    </td>
                  );
                })}
              </tr>

              {/* Row: AI Confidence */}
              <tr className="border-b border-slate-800/40 hover:bg-slate-900/10">
                <td className="p-4 font-semibold text-slate-300">AI Match Confidence</td>
                {candidates.map((cand) => {
                  const conf = cand.screening_results?.[0]?.Confidence_Level || 'High';
                  const confColor = conf === 'High' ? 'text-emerald-400 bg-emerald-950/20' : conf === 'Medium' ? 'text-amber-400 bg-amber-950/20' : 'text-rose-400 bg-rose-950/20';
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${confColor}`}>
                        {conf}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Row: Strengths */}
              <tr className="border-b border-slate-800/40 hover:bg-slate-900/10">
                <td className="p-4 font-semibold text-slate-300 align-top">Key Strengths</td>
                {candidates.map((cand) => {
                  const strengths = cand.screening_results?.[0]?.Explanation?.strengths || [];
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60 align-top">
                      {strengths.length === 0 ? (
                        <span className="text-slate-500 italic">None logged</span>
                      ) : (
                        <ul className="space-y-1 list-disc pl-3 text-slate-300">
                          {strengths.map((str, idx) => (
                            <li key={idx} className="leading-relaxed">{str}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row: Key Gaps */}
              <tr className="hover:bg-slate-900/10">
                <td className="p-4 font-semibold text-slate-300 align-top">Key Gaps</td>
                {candidates.map((cand) => {
                  const gaps = cand.screening_results?.[0]?.Explanation?.gaps || [];
                  return (
                    <td key={cand.Candidate_ID} className="p-4 border-l border-slate-800/60 align-top">
                      {gaps.length === 0 ? (
                        <span className="text-slate-500 italic">None logged</span>
                      ) : (
                        <ul className="space-y-1 list-disc pl-3 text-rose-300">
                          {gaps.map((gap, idx) => (
                            <li key={idx} className="leading-relaxed">{gap}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CandidateCompare;
