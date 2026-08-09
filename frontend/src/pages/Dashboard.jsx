import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Briefcase, FileText, CheckCircle, XCircle, AlertCircle, History, Clock, 
  Layers, Search, Calendar, ChevronRight, BarChart2, TrendingUp, Sparkles, Filter 
} from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_jobs: 0,
    total_candidates: 0,
    candidates_shortlisted: 0,
    candidates_rejected: 0,
    candidates_under_review: 0,
  });
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isAdmin, setIsAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Audit filter states
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const statsRes = await axios.get('/dashboard/stats');
      setStats(statsRes.data);

      const analyticsRes = await axios.get('/dashboard/analytics');
      setAnalytics(analyticsRes.data);

      try {
        const logsRes = await axios.get('/dashboard/audit-logs');
        setLogs(logsRes.data);
        setIsAdmin(true);
      } catch (logErr) {
        if (logErr.response?.status === 403) {
          setIsAdmin(false);
        } else {
          console.error('Audit logs fetch error:', logErr);
        }
      }
      
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not retrieve dashboard statistics. Ensure the server is online.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterAuditLogs = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      setLoading(true);
      let queryParams = [];
      if (actionFilter) queryParams.push(`action=${encodeURIComponent(actionFilter)}`);
      if (startDate) queryParams.push(`start_date=${encodeURIComponent(startDate + 'T00:00:00')}`);
      if (endDate) queryParams.push(`end_date=${encodeURIComponent(endDate + 'T23:59:59')}`);
      
      const url = `/dashboard/audit-logs${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
      const logsRes = await axios.get(url);
      setLogs(logsRes.data);
    } catch (err) {
      console.error(err);
      alert('Failed to filter audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const funnelStages = analytics?.funnel || {
    Applications: 0,
    Screened: 0,
    Shortlisted: 0,
    Interviewed: 0,
    Selected: 0
  };

  const metrics = analytics?.metrics || {
    average_score: 0,
    shortlisting_percentage: 0,
    rejection_percentage: 0,
    average_processing_time_seconds: 0
  };

  const statCards = [
    {
      title: 'Total Job Openings',
      value: stats.total_jobs,
      icon: Briefcase,
      color: 'from-blue-600/10 to-indigo-600/10 border-blue-500/20 text-blue-400',
      badge: 'Active career roles',
    },
    {
      title: 'Total Applications',
      value: stats.total_candidates,
      icon: FileText,
      color: 'from-violet-600/10 to-purple-600/10 border-violet-500/20 text-violet-400',
      badge: 'Resumes uploaded',
    },
    {
      title: 'Shortlisted Candidates',
      value: stats.candidates_shortlisted,
      icon: CheckCircle,
      color: 'from-emerald-600/10 to-teal-600/10 border-emerald-500/20 text-emerald-400',
      badge: `${metrics.shortlisting_percentage}% of screened`,
    },
    {
      title: 'Rejected Candidates',
      value: stats.candidates_rejected,
      icon: XCircle,
      color: 'from-rose-600/10 to-red-600/10 border-rose-500/20 text-rose-400',
      badge: `${metrics.rejection_percentage}% of screened`,
    },
    {
      title: 'Under Review',
      value: stats.candidates_under_review,
      icon: AlertCircle,
      color: 'from-amber-600/10 to-orange-600/10 border-amber-500/20 text-amber-400',
      badge: 'Awaiting review decision',
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">TalentLens MIS Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">Management Information System offering aggregate hiring funnel reports & DSS insights.</p>
        </div>
        <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-slate-400 flex items-center space-x-2">
          <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></span>
          <span>Role: <strong className="text-slate-200">{isAdmin ? 'Admin' : 'Recruiter'}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-300 text-sm flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`glass-panel p-5 rounded-2xl border flex flex-col justify-between hover:scale-[1.01] transition-all bg-gradient-to-br ${card.color}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.title}</span>
                <Icon className="h-4 w-4 opacity-90" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-extrabold text-white">{loading ? '...' : card.value}</span>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">{card.badge}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Analysis Section: Funnel & Skill Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recruitment Funnel Visual */}
        <div className="lg:col-span-2 glass-panel border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
              <Layers className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Recruitment Funnel Conversion</h3>
            </div>
            
            <div className="space-y-4 py-2">
              {Object.entries(funnelStages).map(([stage, count], idx, arr) => {
                const maxCount = arr[0][1] || 1;
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                
                return (
                  <div key={stage} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300 flex items-center">
                        <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-indigo-400 mr-2 font-bold">{idx + 1}</span>
                        {stage}
                      </span>
                      <span className="text-slate-400">
                        {count} <span className="text-[10px] text-slate-500 font-medium">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-950/60 rounded-full overflow-hidden border border-slate-900">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-600 to-brand-500 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-800/60 text-center">
            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-900">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Avg Score</span>
              <span className="text-lg font-bold text-slate-200 mt-1 block">{metrics.average_score}%</span>
            </div>
            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-900">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Shortlist %</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">{metrics.shortlisting_percentage}%</span>
            </div>
            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-900">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Rejection %</span>
              <span className="text-lg font-bold text-rose-400 mt-1 block">{metrics.rejection_percentage}%</span>
            </div>
            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-900">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Parsing Time</span>
              <span className="text-lg font-bold text-slate-200 mt-1 block">{metrics.average_processing_time_seconds}s</span>
            </div>
          </div>
        </div>

        {/* Job candidate distribution list */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
              <BarChart2 className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Candidate Distribution</h3>
            </div>
            
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {analytics?.job_distribution?.map((job, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                  <div className="truncate pr-3">
                    <span className="text-xs font-semibold text-slate-200 block truncate">{job.name}</span>
                    <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mt-0.5">Job Posting #{idx + 1}</span>
                  </div>
                  <span className="text-xs font-bold bg-indigo-950/60 border border-indigo-900 text-indigo-300 px-2.5 py-1 rounded-lg">
                    {job.value} cands
                  </span>
                </div>
              ))}
              {(!analytics?.job_distribution || analytics.job_distribution.length === 0) && (
                <div className="text-center py-12 text-xs text-slate-500 italic">No job postings seeded.</div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl mt-6">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">MIS Funnel Definition</span>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Provides real-time aggregate charts of applicants' conversion steps (TPS input logs aggregated into MIS reports).
            </p>
          </div>
        </div>
      </div>

      {/* Skill Gaps & Demand Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Requested Skills */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100">Most Demanded Skills (Job Requisitions)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analytics?.most_in_demand_skills?.map((skill, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-900">
                <span className="text-xs font-semibold text-slate-300">{skill.name}</span>
                <span className="text-[10px] bg-emerald-950/60 border border-emerald-900 text-emerald-400 px-2 py-0.5 rounded-md font-bold">
                  {skill.value} positions
                </span>
              </div>
            ))}
            {(!analytics?.most_in_demand_skills || analytics.most_in_demand_skills.length === 0) && (
              <div className="col-span-2 text-center py-6 text-xs text-slate-500 italic">No skills cataloged yet.</div>
            )}
          </div>
        </div>

        {/* Top Missing Skills */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <h3 className="font-semibold text-slate-100">Top Missing Skills (Candidate Gaps)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analytics?.most_common_missing_skills?.map((skill, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-900">
                <span className="text-xs font-semibold text-slate-300">{skill.name}</span>
                <span className="text-[10px] bg-rose-950/60 border border-rose-900 text-rose-400 px-2 py-0.5 rounded-md font-bold">
                  {skill.value} gaps
                </span>
              </div>
            ))}
            {(!analytics?.most_common_missing_skills || analytics.most_common_missing_skills.length === 0) && (
              <div className="col-span-2 text-center py-6 text-xs text-slate-500 italic">No candidate missing skills recorded.</div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Audit Logs view */}
      {isAdmin ? (
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 flex flex-col min-h-[500px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-4">
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Compliance & Operations Audit Trails</h3>
            </div>
            
            {/* Filter Form panel */}
            <form onSubmit={handleFilterAuditLogs} className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Action type..."
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-xs rounded-lg text-slate-100 placeholder-slate-600 outline-none w-36 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-[10px] text-slate-300 outline-none"
                />
                <span>➔</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-[10px] text-slate-300 outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 text-xs font-bold rounded-lg transition active:scale-95 flex items-center space-x-1"
              >
                <Filter className="h-3.5 w-3.5 mr-0.5" />
                <span>Filter</span>
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {loading ? (
              <div className="flex justify-center items-center h-48 text-sm text-slate-500">
                Refreshing audit logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex justify-center items-center h-48 text-sm text-slate-500">
                No activity logs match the configured search filters.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.Log_ID} className="flex space-x-3.5 text-sm items-start border-b border-slate-900/60 pb-3 hover:bg-slate-900/10 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-slate-200">{log.Action}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.Timestamp + 'Z').toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{log.Details}</p>
                    <div className="flex items-center space-x-1.5 mt-1.5">
                      <span className="inline-block h-1 w-1 rounded-full bg-indigo-500"></span>
                      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                        By: {log.User_Name}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
          <div className="flex items-center space-x-2 text-amber-400 mb-2">
            <AlertCircle className="h-5 w-5" />
            <h4 className="font-semibold">Audit Logs Restricted</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Operations and compliance audit logs are strictly restricted to <strong>Administrator</strong> accounts. Recruiter role accounts cannot view the permanent system audit trail.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
