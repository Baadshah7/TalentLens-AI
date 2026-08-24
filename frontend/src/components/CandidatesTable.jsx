import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, FileX } from 'lucide-react';

const CandidatesTable = ({
  candidates,
  totalCandidatesCount,
  selectedCandidates,
  handleSelectCandidate,
  selectedJobId,
  selectedJob,
  candidatesLoading,
  getActiveFilterCount
}) => {

  const getScoreDetails = (score) => {
    if (score === null || score === undefined) {
      return { 
        badgeClass: 'text-slate-500 italic text-[10px]', 
        barColor: '',
        text: '—' 
      };
    }
    
    if (score >= 70) {
      return {
        badgeClass: 'bg-emerald-950/40 border-emerald-900 text-emerald-400',
        barColor: 'from-emerald-600 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
        text: `${score}%`
      };
    } else if (score >= 50) {
      return {
        badgeClass: 'bg-amber-950/40 border-amber-900 text-amber-400',
        barColor: 'from-amber-600 to-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
        text: `${score}%`
      };
    } else {
      return {
        badgeClass: 'bg-red-950/40 border-red-900 text-red-400',
        barColor: 'from-rose-600 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
        text: `${score}%`
      };
    }
  };

  const hasActiveFilters = getActiveFilterCount() > 0;

  // Render skeleton loading rows
  if (candidatesLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-slate-400 font-bold uppercase tracking-wider sticky top-0 bg-slate-900/90 z-10 shadow-sm backdrop-blur-md">
              <th className="pb-3 pt-1 font-semibold text-center w-12">Select</th>
              <th className="pb-3 pt-1 font-semibold">Candidate Name</th>
              <th className="pb-3 pt-1 font-semibold">Filename</th>
              <th className="pb-3 pt-1 font-semibold">Upload Date</th>
              <th className="pb-3 pt-1 font-semibold text-center">Match Score</th>
              <th className="pb-3 pt-1 font-semibold text-center">Recruiter Decision</th>
              <th className="pb-3 pt-1 font-semibold text-right">Integrity Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, idx) => (
              <tr key={idx} className="border-b border-slate-900/60 animate-pulse">
                <td className="py-4 text-center">
                  <div className="h-3.5 w-3.5 bg-slate-800 rounded mx-auto"></div>
                </td>
                <td className="py-4">
                  <div className="h-4 w-32 bg-slate-800 rounded"></div>
                </td>
                <td className="py-4">
                  <div className="h-3.5 w-24 bg-slate-800 rounded"></div>
                </td>
                <td className="py-4">
                  <div className="h-3.5 w-20 bg-slate-800 rounded"></div>
                </td>
                <td className="py-4">
                  <div className="h-4 w-28 bg-slate-800 rounded mx-auto"></div>
                </td>
                <td className="py-4">
                  <div className="h-4.5 w-20 bg-slate-800 rounded mx-auto"></div>
                </td>
                <td className="py-4">
                  <div className="h-4.5 w-24 bg-slate-800 rounded ml-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Render empty state
  if (candidates.length === 0) {
    return (
      <div className="text-center py-14 p-6 border border-slate-900 border-dashed rounded-2xl bg-slate-950/20 max-w-lg mx-auto flex flex-col items-center justify-center space-y-3.5 animate-in fade-in duration-300">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-full text-slate-500 shadow-inner">
          <FileX className="h-8 w-8" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-200">No Candidates Found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters 
              ? 'No candidate profiles match your current search filters. Try clearing some criteria to expand your search.'
              : 'There are no resumes uploaded for this position yet. Drag and drop PDF or DOCX candidate resumes on the left to begin automated screening.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dynamic Count Banner */}
      <div className="flex justify-between items-center text-xs font-semibold text-slate-400 bg-slate-950/30 px-4 py-2.5 rounded-xl border border-slate-900 shadow-sm">
        <span>
          {hasActiveFilters ? (
            <>
              Showing <strong className="text-indigo-400">{candidates.length}</strong> matching of <strong className="text-slate-350">{totalCandidatesCount}</strong> total candidates
            </>
          ) : (
            <>
              Total Candidates screened: <strong className="text-slate-200">{totalCandidatesCount}</strong>
            </>
          )}
        </span>
      </div>

      <div className="overflow-x-auto pr-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-slate-400 font-bold uppercase tracking-wider sticky top-0 bg-slate-900/90 z-10 shadow-sm backdrop-blur-md">
              <th className="pb-3 pt-1 font-semibold text-center w-12">Select</th>
              <th className="pb-3 pt-1 font-semibold">Candidate Name</th>
              <th className="pb-3 pt-1 font-semibold">Filename</th>
              <th className="pb-3 pt-1 font-semibold">Upload Date</th>
              <th className="pb-3 pt-1 font-semibold text-center">Match Score</th>
              <th className="pb-3 pt-1 font-semibold text-center">Recruiter Decision</th>
              <th className="pb-3 pt-1 font-semibold text-right">Integrity Status</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((cand) => {
              const isFailed = cand.Processing_Status === 'Failed';
              const { badgeClass, barColor, text } = getScoreDetails(cand.Overall_Score);
              
              return (
                <tr 
                  key={cand.Candidate_ID} 
                  className={`border-b border-slate-900/60 last:border-0 transition-colors duration-200 ${
                    isFailed 
                      ? 'bg-red-950/10 border-b border-red-900/20 hover:bg-red-950/15' 
                      : 'hover:bg-slate-900/30'
                  }`}
                >
                  {/* Select Column */}
                  <td className="py-3 text-center">
                    <input
                      type="checkbox"
                      disabled={isFailed}
                      checked={selectedCandidates.includes(cand.Candidate_ID)}
                      onChange={() => handleSelectCandidate(cand.Candidate_ID)}
                      className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500/30 w-3.5 h-3.5 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                  
                  {/* Name Column */}
                  <td className="py-3 font-semibold">
                    <Link 
                      to={`/candidate/${cand.Candidate_ID}`} 
                      className={`text-brand-400 hover:text-indigo-400 font-bold transition duration-200 hover:underline ${
                        isFailed ? 'text-slate-350 cursor-not-allowed hover:text-slate-350 hover:no-underline' : ''
                      }`}
                      onClick={(e) => isFailed && e.preventDefault()}
                    >
                      {cand.Name}
                    </Link>
                  </td>
                  
                  {/* Filename Column */}
                  <td className={`py-3 max-w-[140px] truncate ${isFailed ? 'text-slate-400 font-medium' : 'text-slate-450'}`} title={cand.Resume_File_Path.split(/[\\/]/).pop()}>
                    {cand.Resume_File_Path.split(/[\\/]/).pop()}
                  </td>
                  
                  {/* Upload Date Column */}
                  <td className={`py-3 ${isFailed ? 'text-slate-400 font-medium' : 'text-slate-500'}`}>
                    {new Date(cand.Upload_Date).toLocaleDateString()}
                  </td>
                  
                  {/* Match Score Column with visual indicator */}
                  <td className="py-3 text-center">
                    {cand.Overall_Score !== null && cand.Overall_Score !== undefined && !isFailed ? (
                      <div className="flex items-center justify-center space-x-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-inner ${badgeClass}`}>
                          {text}
                        </span>
                        <div className="h-1.5 w-16 bg-slate-950 rounded-full overflow-hidden border border-slate-900 hidden sm:block shadow-inner">
                          <div 
                            className={`h-full bg-gradient-to-r ${barColor} rounded-full`}
                            style={{ width: `${cand.Overall_Score}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-550 italic text-[10px]">—</span>
                    )}
                  </td>
                  
                  {/* Recruiter Decision Column */}
                  <td className="py-3 text-center">
                    {cand.Decision && !isFailed ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border shadow-sm ${
                        cand.Decision === 'Shortlist' 
                          ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' 
                          : cand.Decision === 'Reject'
                            ? 'bg-rose-950/40 border-rose-900 text-rose-450'
                            : cand.Decision === 'Interview'
                              ? 'bg-indigo-950/40 border-indigo-900 text-indigo-400'
                              : 'bg-amber-950/40 border-amber-900 text-amber-400'
                      }`}>
                        {cand.Decision}
                      </span>
                    ) : (
                      <span className={`text-[10px] italic ${isFailed ? 'text-slate-400 font-medium' : 'text-slate-500'}`}>
                        {isFailed ? 'Processing Aborted' : 'Awaiting Review'}
                      </span>
                    )}
                  </td>
                  
                  {/* Integrity Status Column */}
                  <td className="py-3 text-right">
                    {cand.Processing_Status === 'Pending' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/60 border border-blue-900/50 text-blue-300">
                        Valid (Pending)
                      </span>
                    )}
                    {cand.Processing_Status === 'Parsed' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 border border-emerald-900/50 text-emerald-300 shadow-sm">
                        Parsed
                      </span>
                    )}
                    {cand.Processing_Status === 'Failed' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 border border-red-900/60 text-red-300 shadow-sm" title="File format is invalid, empty, or corrupted.">
                        Corrupted (Failed)
                      </span>
                    )}
                    {cand.Processing_Status === 'Processing' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 border border-amber-900/50 text-amber-300 animate-pulse">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin mr-1 text-amber-400" />
                        <span>Processing</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CandidatesTable;
