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
  const [upcomingItvs, setUpcomingItvs] = useState([]);
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
        const itvsRes = await axios.get('/interviews?upcoming=true');
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        const filtered = itvsRes.data.filter(itv => new Date(itv.Interview_DateTime) <= next7Days);
        setUpcomingItvs(filtered);
      } catch (itvErr) {
        console.error('Interviews fetch error:', itvErr);
      }

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
      color: 'border-l-blue-500 hover:shadow-blue-500/5 text-blue-400',
      bgColor: 'bg-gradient-to-br from-blue-600/5 to-indigo-600/5',
      badge: 'Active career roles',
      trend: stats.total_jobs > 0 ? '+1 active today' : 'No active jobs',
      trendColor: 'text-blue-400',
      emptyNudge: 'Create a job posting to begin collecting resumes.',
    },
    {
      title: 'Total Applications',
      value: stats.total_candidates,
      icon: FileText,
      color: 'border-l-violet-500 hover:shadow-violet-500/5 text-violet-400',
      bgColor: 'bg-gradient-to-br from-violet-600/5 to-purple-600/5',
      badge: 'Resumes uploaded',
      trend: stats.total_candidates > 0 ? `+${stats.total_candidates} resumes parsed` : '0 resumes parsed',
      trendColor: 'text-violet-400',
      emptyNudge: 'Upload candidate resumes in the Resume Upload tab.',
    },
    {
      title: 'Shortlisted Candidates',
      value: stats.candidates_shortlisted,
      icon: CheckCircle,
      color: 'border-l-emerald-500 hover:shadow-emerald-500/5 text-emerald-400',
      bgColor: 'bg-gradient-to-br from-emerald-600/5 to-teal-600/5',
      badge: `${metrics.shortlisting_percentage}% of screened`,
      trend: stats.candidates_shortlisted > 0 ? `↑ ${metrics.shortlisting_percentage}% fit rate` : 'N/A fit rate',
      trendColor: 'text-emerald-400',
      emptyNudge: 'No one shortlisted yet — review screened candidates.',
    },
    {
      title: 'Rejected Candidates',
      value: stats.candidates_rejected,
      icon: XCircle,
      color: 'border-l-rose-500 hover:shadow-rose-500/5 text-rose-400',
      bgColor: 'bg-gradient-to-br from-rose-600/5 to-red-600/5',
      badge: `${metrics.rejection_percentage}% of screened`,
      trend: stats.candidates_rejected > 0 ? `↓ ${metrics.rejection_percentage}% rejection` : '0% increase',
      trendColor: 'text-slate-400',
      emptyNudge: '0 candidates rejected. Good candidate alignment.',
    },
    {
      title: 'Under Review',
      value: stats.candidates_under_review,
      icon: AlertCircle,
      color: 'border-l-amber-500 hover:shadow-amber-500/5 text-amber-400',
      bgColor: 'bg-gradient-to-br from-amber-600/5 to-orange-600/5',
      badge: 'Awaiting review decision',
      trend: stats.candidates_under_review > 0 ? '+1 pending interview' : 'All reviews caught up',
      trendColor: 'text-amber-400',
      emptyNudge: 'All reviews are completed. Good job!',
    },
  ];

  const funnelGradations = [
    { stage: 'Applications', taper: 100, color: 'from-indigo-600 to-indigo-500 shadow-indigo-500/10' },
    { stage: 'Screened', taper: 90, color: 'from-purple-600 to-purple-500 shadow-purple-500/10' },
    { stage: 'Shortlisted', taper: 80, color: 'from-teal-600 to-teal-500 shadow-teal-500/10' },
    { stage: 'Interviewed', taper: 70, color: 'from-blue-600 to-blue-500 shadow-blue-500/10' },
    { stage: 'Selected', taper: 60, color: 'from-emerald-600 to-emerald-500 shadow-emerald-500/10' },
  ];

  // Helper mappings for comparative skills gap analysis
  const demandMap = {};
  analytics?.most_in_demand_skills?.forEach(s => { demandMap[s.name.toLowerCase()] = s.value; });

  const missingMap = {};
  analytics?.most_common_missing_skills?.forEach(s => { missingMap[s.name.toLowerCase()] = s.value; });

  const maxDemand = Math.max(...(analytics?.most_in_demand_skills?.map(s => s.value) || [1]));
  const maxMissing = Math.max(...(analytics?.most_common_missing_skills?.map(s => s.value) || [1]));

  return (
    <div className="space-y-10 p-6 md:p-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">TalentLens Hiring Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">A clear, explainable view of your hiring funnel and recruitment insights.</p>
        </div>
        <div className="text-xs bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-400 flex items-center space-x-2 shadow-lg backdrop-blur-md">
          <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></span>
          <span>Role: <strong className="text-slate-200">{isAdmin ? 'Admin' : 'Recruiter'}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-300 text-sm flex items-center space-x-2 shadow-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          const isZero = loading ? false : card.value === 0;

          return (
            <div
              key={idx}
              className={`glass-panel p-5 rounded-2xl border border-slate-800/80 border-l-4 shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group ${card.color} ${card.bgColor}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">{card.title}</span>
                <div className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-850 text-slate-300 group-hover:scale-110 transition-transform">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white tracking-tight">
                  {loading ? (
                    <span className="inline-block h-8 w-12 bg-slate-800/60 animate-pulse rounded-md"></span>
                  ) : (
                    card.value
                  )}
                </span>
                
                {isZero ? (
                  <p className="text-[10px] text-slate-400 leading-snug italic font-medium mt-2 bg-slate-950/40 p-2 rounded-xl border border-slate-900/50">
                    {card.emptyNudge}
                  </p>
                ) : (
                  <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-slate-950/60 text-[10px]">
                    <span className="text-slate-400 font-medium">{card.badge}</span>
                    <span className={`font-bold flex items-center ${card.trendColor}`}>
                      {card.trend}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Analysis Section: Funnel & Skill Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recruitment Funnel Visual */}
        <div className="lg:col-span-2 glass-panel border border-slate-800/80 rounded-2xl p-6 shadow-xl bg-slate-900/40 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-5">
              <div className="flex items-center space-x-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-100 text-base">Recruitment Funnel Conversion</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Stage volume & conversion rates</span>
            </div>
            
            <div className="space-y-4 py-2 flex flex-col">
              {funnelGradations.map((item, idx) => {
                const stage = item.stage;
                const count = funnelStages[stage] || 0;
                const maxCount = funnelStages['Applications'] || 1;
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                
                return (
                  <div key={stage} className="space-y-1.5 flex flex-col items-center">
                    <div className="w-full flex justify-between text-xs font-semibold px-2" style={{ width: `${item.taper}%` }}>
                      <span className="text-slate-300 flex items-center">
                        <span className="h-5 w-5 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-[10px] text-indigo-400 mr-2 font-bold shadow-md">{idx + 1}</span>
                        {stage}
                      </span>
                      <span className="text-slate-400">
                        {count} <span className="text-[10px] text-slate-500 font-bold">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div 
                      className="h-3 w-full bg-slate-950/60 rounded-full overflow-hidden border border-slate-900/80 shadow-inner p-0.5"
                      style={{ width: `${item.taper}%` }}
                    >
                      <div 
                        className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-700 ease-out`} 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-850 text-center">
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/60 shadow-inner">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Avg Fit Score</span>
              <span className="text-xl font-black text-slate-200 mt-1 block">{metrics.average_score}%</span>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/60 shadow-inner">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Shortlist %</span>
              <span className="text-xl font-black text-emerald-400 mt-1 block">{metrics.shortlisting_percentage}%</span>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/60 shadow-inner">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Rejection %</span>
              <span className="text-xl font-black text-rose-400 mt-1 block">{metrics.rejection_percentage}%</span>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900/60 shadow-inner">
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Parsing Time</span>
              <span className="text-xl font-black text-slate-200 mt-1 block">{metrics.average_processing_time_seconds}s</span>
            </div>
          </div>
        </div>

        {/* Job candidate distribution list */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 shadow-xl bg-slate-900/40 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-850 pb-4 mb-4">
              <BarChart2 className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100 text-base">Candidate Distribution</h3>
            </div>
            
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {analytics?.job_distribution?.map((job, idx) => {
                const maxVal = Math.max(...(analytics?.job_distribution?.map(j => j.value) || [1]));
                const pct = maxVal > 0 ? (job.value / maxVal) * 100 : 0;
                
                return (
                  <div key={idx} className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-850 transition-colors flex flex-col space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="truncate pr-3">
                        <span className="text-xs font-semibold text-slate-200 block truncate">{job.name}</span>
                        <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mt-0.5">Job Posting #{idx + 1}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-indigo-950/60 border border-indigo-900/60 text-indigo-300 px-2.5 py-0.5 rounded-lg flex-shrink-0 shadow-sm">
                        {job.value} {job.value === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>
                    {/* Visual inline sparkline bar */}
                    <div className="flex items-center space-x-2">
                      <div className="h-1.5 flex-1 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold w-6 text-right">{(pct).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
              {(!analytics?.job_distribution || analytics.job_distribution.length === 0) && (
                <div className="text-center py-12 text-xs text-slate-500 italic">No job postings yet.</div>
              )}
            </div>
          </div>

          {/* Card: Upcoming Interviews (Next 7 Days) */}
          <div className="border-t border-slate-850 mt-5 pt-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3 flex items-center">
              <Calendar className="h-4 w-4 mr-1 text-indigo-400" />
              <span>Upcoming Interviews (Next 7 Days)</span>
            </span>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {upcomingItvs.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500 italic">No sessions scheduled.</div>
              ) : (
                upcomingItvs.map(itv => (
                  <div key={itv.Interview_ID} className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900 flex justify-between items-center text-[11px] hover:border-slate-850 transition-colors">
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-200 block truncate">{itv.Candidate_Name}</span>
                      <span className="text-[9px] text-slate-450 block mt-0.5">
                        {new Date(itv.Interview_DateTime).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                      </span>
                    </div>
                    <span className="text-[8px] bg-indigo-950/60 border border-indigo-900 text-indigo-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      {itv.Mode}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-900 rounded-xl mt-5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Funnel Calculations</span>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              This pipeline tracks candidates sequentially from upload (Applications) through to screening, shortlist, and selection.
            </p>
          </div>
        </div>
      </div>

      {/* Skill Gaps & Demand Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Requested Skills */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 shadow-xl bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center space-x-2 border-b border-slate-850 pb-4 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-base">Most Demanded Skills (Jobs)</h3>
          </div>
          <div className="grid grid-cols-1 gap-3.5 max-h-[350px] overflow-y-auto pr-1">
            {analytics?.most_in_demand_skills?.map((skill, idx) => {
              const pct = maxDemand > 0 ? (skill.value / maxDemand) * 100 : 0;
              const hasGap = missingMap[skill.name.toLowerCase()];

              return (
                <div key={idx} className="flex flex-col space-y-1.5 p-3.5 bg-slate-950/40 rounded-xl border border-slate-900 hover:border-slate-850 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-200">{skill.name}</span>
                      {hasGap && (
                        <span className="text-[8px] bg-amber-950/50 border border-amber-800/40 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Candidate Gap
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] bg-emerald-950/60 border border-emerald-900/60 text-emerald-450 px-2.5 py-0.5 rounded font-bold shadow-sm flex-shrink-0">
                      {skill.value} {skill.value === 1 ? 'job' : 'jobs'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {(!analytics?.most_in_demand_skills || analytics.most_in_demand_skills.length === 0) && (
              <div className="text-center py-12 text-xs text-slate-500 italic">No requested skills cataloged yet.</div>
            )}
          </div>
        </div>

        {/* Top Missing Skills */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 shadow-xl bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center space-x-2 border-b border-slate-850 pb-4 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-450" />
            <h3 className="font-semibold text-slate-100 text-base">Top Missing Skills (Candidate Gaps)</h3>
          </div>
          <div className="grid grid-cols-1 gap-3.5 max-h-[350px] overflow-y-auto pr-1">
            {analytics?.most_common_missing_skills?.map((skill, idx) => {
              const pct = maxMissing > 0 ? (skill.value / maxMissing) * 100 : 0;
              const hasDemand = demandMap[skill.name.toLowerCase()];

              return (
                <div key={idx} className="flex flex-col space-y-1.5 p-3.5 bg-slate-950/40 rounded-xl border border-slate-900 hover:border-slate-850 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-200">{skill.name}</span>
                      {hasDemand && (
                        <span className="text-[8px] bg-rose-950/60 border border-rose-800/50 text-rose-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                          High Demand Gap
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] bg-rose-950/60 border border-rose-900/65 text-rose-400 px-2.5 py-0.5 rounded font-bold shadow-sm flex-shrink-0">
                      {skill.value} {skill.value === 1 ? 'gap' : 'gaps'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-600 to-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {(!analytics?.most_common_missing_skills || analytics.most_common_missing_skills.length === 0) && (
              <div className="text-center py-12 text-xs text-slate-500 italic">No candidate missing skills recorded.</div>
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
