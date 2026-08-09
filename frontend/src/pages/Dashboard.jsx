import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Briefcase, FileText, CheckCircle, XCircle, AlertCircle, History, Clock } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_jobs: 0,
    total_candidates: 0,
    candidates_shortlisted: 0,
    candidates_rejected: 0,
    candidates_under_review: 0,
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes] = await Promise.all([
        axios.get('/dashboard/stats'),
        axios.get('/dashboard/audit-logs'),
      ]);
      setStats(statsRes.data);
      setLogs(logsRes.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not retrieve dashboard statistics. Ensure the server is online.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: 'Total Job Openings',
      value: stats.total_jobs,
      icon: Briefcase,
      color: 'from-blue-600/10 to-indigo-600/10 border-blue-500/20 text-blue-400',
      badge: 'Active positions',
    },
    {
      title: 'Resumes Uploaded',
      value: stats.total_candidates,
      icon: FileText,
      color: 'from-violet-600/10 to-purple-600/10 border-violet-500/20 text-violet-400',
      badge: 'Total cataloged',
    },
    {
      title: 'Candidates Shortlisted',
      value: stats.candidates_shortlisted,
      icon: CheckCircle,
      color: 'from-emerald-600/10 to-teal-600/10 border-emerald-500/20 text-emerald-400',
      badge: 'Phase 2 scoring placeholder',
    },
    {
      title: 'Candidates Rejected',
      value: stats.candidates_rejected,
      icon: XCircle,
      color: 'from-rose-600/10 to-red-600/10 border-rose-500/20 text-rose-400',
      badge: 'Phase 2 scoring placeholder',
    },
    {
      title: 'Under Review',
      value: stats.candidates_under_review,
      icon: AlertCircle,
      color: 'from-amber-600/10 to-orange-600/10 border-amber-500/20 text-amber-400',
      badge: 'Phase 2 scoring placeholder',
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">HR Analytics Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">Real-time candidate statistics and database activity logging.</p>
      </div>

      {error && (
        <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-xl text-amber-300 text-sm flex items-center space-x-2">
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
              className={`glass-card p-5 rounded-2xl border flex flex-col justify-between hover:scale-[1.01] transition-all bg-gradient-to-br ${card.color}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-85 text-slate-300">{card.title}</span>
                <Icon className="h-5 w-5 opacity-90" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-extrabold text-white">{loading ? '...' : card.value}</span>
                <p className="text-[10px] opacity-75 mt-1">{card.badge}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Audit Logs and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent logs */}
        <div className="lg:col-span-2 glass-panel border border-slate-800/80 rounded-2xl p-6 flex flex-col h-[500px]">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
            <History className="h-5 w-5 text-brand-400" />
            <h3 className="font-semibold text-slate-100">System Activity Audit Log</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {loading ? (
              <div className="flex justify-center items-center h-full text-sm text-slate-500">
                Loading audit trails...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex justify-center items-center h-full text-sm text-slate-500">
                No activity logged yet. Action events will appear here.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.Log_ID} className="flex space-x-3.5 text-sm items-start border-b border-slate-900/60 pb-3">
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
                    <p className="text-xs text-slate-400 mt-1">{log.Details}</p>
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

        {/* Phase Info Panel */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
              <CheckCircle className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Project Milestone</h3>
            </div>
            <div className="space-y-4">
              <div>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-600/20 text-brand-400 border border-brand-500/20">
                  Phase 1: Foundation
                </span>
                <h4 className="text-sm font-bold text-slate-200 mt-2">Data Layer & Basic Portal</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Authentication, CRUD operations for Job descriptions, and multi-file resume uploading are functional. Resume processing state defaults to <strong>Pending</strong> (or <strong>Failed</strong> if the document's structure is unreadable).
                </p>
              </div>

              <div className="border-t border-slate-800/60 pt-4 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Next Phase Preview</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong>Phase 2 (NLP & Matching)</strong> will introduce real PDF/DOCX content extraction, Named Entity Recognition (NER) for skill harvesting, and semantic similarity scoring using local embedding models.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-xl mt-6">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Database Mode</span>
            <span className="text-xs font-semibold text-brand-400">SQLite (Dev)</span>
            <p className="text-[10px] text-slate-500 mt-0.5">Written schema adheres fully to PostgreSQL standards.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
