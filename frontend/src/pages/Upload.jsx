import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Upload, Briefcase, FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw, Trash2, ShieldAlert, Sparkles, Scale } from 'lucide-react';

const UploadPage = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const fileInputRef = useRef(null);

  // Phase 3 selection state
  const [selectedCandidates, setSelectedCandidates] = useState([]);

  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      const res = await axios.get('/jobs/');
      setJobs(res.data);
      if (res.data.length > 0 && !selectedJobId) {
        setSelectedJobId(res.data[0].Job_ID.toString());
      }
    } catch (err) {
      console.error('Failed to retrieve jobs', err);
    } finally {
      setJobsLoading(false);
    }
  };

  const fetchCandidates = async () => {
    if (!selectedJobId) return;
    try {
      setCandidatesLoading(true);
      const res = await axios.get(`/candidates/job/${selectedJobId}`);
      setCandidates(res.data);
    } catch (err) {
      console.error('Failed to retrieve candidates', err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    setSelectedCandidates([]);
    fetchCandidates();
  }, [selectedJobId]);

  const selectedJob = jobs.find(j => j.Job_ID === Number(selectedJobId));

  const toggleBlindMode = async () => {
    if (!selectedJob) return;
    try {
      const updatedJob = {
        Job_Title: selectedJob.Job_Title,
        Department: selectedJob.Department,
        Description: selectedJob.Description,
        Required_Skills: selectedJob.Required_Skills,
        Preferred_Skills: selectedJob.Preferred_Skills,
        Min_Experience: selectedJob.Min_Experience,
        Min_Education: selectedJob.Min_Education,
        Certifications: selectedJob.Certifications,
        Job_Type: selectedJob.Job_Type,
        Location: selectedJob.Location,
        Weights: selectedJob.weights.reduce((acc, curr) => ({ ...acc, [curr.Category]: curr.Weight }), {}),
        Blind_Mode: !selectedJob.Blind_Mode,
        Strong_Threshold: selectedJob.Strong_Threshold,
        Good_Threshold: selectedJob.Good_Threshold,
        Potential_Threshold: selectedJob.Potential_Threshold
      };
      await axios.put(`/jobs/${selectedJobId}`, updatedJob);
      await fetchJobs();
      await fetchCandidates();
    } catch (err) {
      console.error("Failed to toggle blind mode", err);
      alert("Failed to toggle blind mode.");
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (files) => {
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    const newQueue = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      
      let error = '';
      if (!validExtensions.includes(ext)) {
        error = 'Invalid extension (PDF, DOCX, TXT only)';
      } else if (file.size > maxSizeBytes) {
        error = 'Oversized (Max 10MB)';
      }

      newQueue.push({
        id: Math.random().toString(),
        file: file,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        status: error ? 'error' : 'queued',
        error: error
      });
    }

    setUploadQueue(prev => [...prev, ...newQueue]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const removeQueueItem = (id) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const uploadQueuedFiles = async () => {
    if (!selectedJobId) {
      alert('Please select a target job position first.');
      return;
    }

    const eligible = uploadQueue.filter(item => item.status === 'queued');
    if (eligible.length === 0) return;

    setUploading(true);

    try {
      const formData = new FormData();
      eligible.forEach(item => {
        formData.append('files', item.file);
      });

      const response = await axios.post(`/candidates/upload/${selectedJobId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const results = response.data.results || [];
      
      // Update upload queue item status
      setUploadQueue(prev => {
        return prev.map(item => {
          const match = results.find(r => r.filename === item.name);
          if (match) {
            return {
              ...item,
              status: match.error ? 'error' : 'uploaded',
              error: match.error || ''
            };
          }
          return item;
        });
      });

      // Clear successful items from queue
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.status === 'error' || item.status === 'queued'));
      }, 3000);

      // Refresh applicant database list
      fetchCandidates();

    } catch (err) {
      console.error(err);
      alert('Batch upload processing failure.');
    } finally {
      setUploading(false);
    }
  };

  // Checkbox select toggle
  const handleSelectCandidate = (candidateId) => {
    setSelectedCandidates(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      } else {
        if (prev.length >= 4) {
          alert("Comparison limit is capped at 4 candidates.");
          return prev;
        }
        return [...prev, candidateId];
      }
    });
  };

  const handleExportCSV = async () => {
    if (!selectedJobId) return;
    try {
      const response = await axios.get(`/jobs/${selectedJobId}/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `screening_report_job_${selectedJobId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert('Failed to export screening CSV report.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
          <Upload className="h-5 w-5 text-indigo-400" />
          <span>Resume Ingestion & Screening</span>
        </h2>
        <p className="text-xs text-slate-400">
          Upload resumes and calculate match scores dynamically based on position parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Target Position Selection card */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
              <Briefcase className="h-4.5 w-4.5 text-brand-400" />
              <span>Target Position</span>
            </h3>
            
            {jobsLoading ? (
              <div className="text-xs text-slate-500 flex items-center space-x-2">
                <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                <span>Loading roles...</span>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-xs text-amber-400">No active positions. Create a job first.</div>
            ) : (
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none transition text-sm"
              >
                {jobs.map(j => (
                  <option key={j.Job_ID} value={j.Job_ID}>{j.Job_Title} ({j.Department})</option>
                ))}
              </select>
            )}

            {selectedJob && (
              <div className="mt-4 border-t border-slate-800/80 pt-4 space-y-3.5">
                {/* Blind Mode Toggle */}
                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                  <div className="text-[11px] text-slate-400 pr-2">
                    <div className="font-semibold text-slate-200">Blind Screening Mode</div>
                    <div className="text-[10px]">Anonymize candidate names and contacts</div>
                  </div>
                  <button
                    onClick={toggleBlindMode}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      selectedJob.Blind_Mode ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        selectedJob.Blind_Mode ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Ethical compliance check */}
                <div className="flex items-center space-x-2 text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/60 p-2.5 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">✓ Ethical Screening Enforced (Protected attributes omitted)</span>
                </div>
              </div>
            )}
          </div>

          {/* Drag & Drop Area */}
          <div 
            className={`glass-panel border border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px] ${
              dragActive 
                ? 'border-brand-500 bg-brand-500/5 glow-accent-indigo' 
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/10'
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 text-indigo-400 mb-3" />
            <p className="text-xs font-semibold text-slate-200">Drag & Drop resumes here</p>
            <p className="text-[10px] text-slate-500 mt-1">or click to browse local files</p>
            <span className="text-[9px] text-indigo-500/80 mt-4 uppercase tracking-widest font-semibold">PDF, DOCX, TXT (Max 10MB)</span>
          </div>

          {/* Upload Queue list */}
          {uploadQueue.length > 0 && (
            <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="text-xs font-semibold text-slate-300">File Ingestion Queue</h4>
                <button
                  onClick={uploadQueuedFiles}
                  disabled={uploading || !uploadQueue.some(i => i.status === 'queued')}
                  className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-[10px] font-bold text-slate-100 rounded-lg transition"
                >
                  {uploading ? 'Processing...' : 'Run Analysis'}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {uploadQueue.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-900 rounded-lg text-[10px]">
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                      <span className="text-slate-300 truncate" title={item.name}>{item.name}</span>
                      <span className="text-[9px] text-slate-500">({item.size})</span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {item.status === 'uploaded' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {item.status === 'error' && (
                        <span className="text-[9px] text-rose-400 font-semibold max-w-[80px] truncate" title={item.error}>
                          {item.error}
                        </span>
                      )}
                      {item.status === 'queued' && <span className="text-indigo-400 text-[8px] font-bold uppercase">Queued</span>}
                      <button onClick={() => removeQueueItem(item.id)} className="text-slate-500 hover:text-rose-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Applicants Directory Table */}
        <div className="lg:col-span-2">
          
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="font-semibold text-slate-100">Uploaded Candidates</h3>
              </div>
              <div className="flex items-center space-x-3">
                {candidates.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                    title="Export all screening scores to CSV"
                  >
                    <span>Export CSV</span>
                  </button>
                )}
                {selectedCandidates.length > 0 && (
                  <span className="text-[10px] bg-indigo-950/40 border border-indigo-900 text-indigo-300 px-2 py-0.5 rounded-md font-semibold animate-pulse">
                    Selected for comparison: {selectedCandidates.length}
                  </span>
                )}
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-semibold">
                  Total: {candidates.length}
                </span>
              </div>
            </div>

            {candidatesLoading ? (
              <div className="text-center py-10 text-xs text-slate-500">
                Updating directory...
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 italic">
                No resumes uploaded yet for this position.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 font-semibold text-center w-8">Select</th>
                      <th className="pb-3 font-semibold">Candidate Name</th>
                      <th className="pb-3 font-semibold">Filename</th>
                      <th className="pb-3 font-semibold">Upload Date</th>
                      <th className="pb-3 font-semibold text-center">Match Score</th>
                      <th className="pb-3 font-semibold text-center">Recruiter Decision</th>
                      <th className="pb-3 font-semibold text-right">Integrity Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((cand) => (
                      <tr key={cand.Candidate_ID} className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/20">
                        {/* Checkbox column */}
                        <td className="py-3 text-center">
                          <input
                            type="checkbox"
                            disabled={cand.Processing_Status === 'Failed'}
                            checked={selectedCandidates.includes(cand.Candidate_ID)}
                            onChange={() => handleSelectCandidate(cand.Candidate_ID)}
                            className="rounded border-slate-850 bg-slate-900 text-indigo-600 focus:ring-indigo-500/30 w-3.5 h-3.5"
                          />
                        </td>
                        <td className="py-3 font-semibold text-slate-200">
                          <Link 
                            to={`/candidate/${cand.Candidate_ID}`} 
                            className="text-brand-400 hover:text-brand-300 underline font-bold transition"
                          >
                            {cand.Name}
                          </Link>
                        </td>
                        <td className="py-3 text-slate-400 max-w-[150px] truncate" title={cand.Resume_File_Path.split(/[\\/]/).pop()}>
                          {cand.Resume_File_Path.split(/[\\/]/).pop()}
                        </td>
                        <td className="py-3 text-slate-500">
                          {new Date(cand.Upload_Date + 'Z').toLocaleDateString()}
                        </td>
                        <td className="py-3 text-center">
                          {cand.Overall_Score !== null && cand.Overall_Score !== undefined ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              cand.Overall_Score >= 70 
                                ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' 
                                : cand.Overall_Score >= 50 
                                  ? 'bg-amber-950/40 border-amber-900 text-amber-400' 
                                  : 'bg-red-950/40 border-red-900 text-red-400'
                            }`}>
                              {cand.Overall_Score}%
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {cand.Decision ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              cand.Decision === 'Shortlist' 
                                ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' 
                                : cand.Decision === 'Reject'
                                  ? 'bg-rose-950/40 border-rose-900 text-rose-400'
                                  : cand.Decision === 'Interview'
                                    ? 'bg-indigo-950/40 border-indigo-900 text-indigo-400'
                                    : 'bg-amber-950/40 border-amber-900 text-amber-400'
                            }`}>
                              {cand.Decision}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">Awaiting Review</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {cand.Processing_Status === 'Pending' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/60 border border-blue-900/50 text-blue-300">
                              Valid (Pending)
                            </span>
                          )}
                          {cand.Processing_Status === 'Parsed' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 border border-emerald-900/50 text-emerald-300">
                              Parsed
                            </span>
                          )}
                          {cand.Processing_Status === 'Failed' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-950/60 border border-red-900/50 text-red-300" title="File format is invalid, empty, or corrupted.">
                              Corrupted (Failed)
                            </span>
                          )}
                          {cand.Processing_Status === 'Processing' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 border border-amber-900/50 text-amber-300">
                              Processing
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating comparison drawer */}
      {selectedCandidates.length >= 2 && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/90 backdrop-blur border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-xs">
            <div className="font-bold text-slate-100 flex items-center space-x-1">
              <Scale className="h-3.5 w-3.5 text-indigo-400" />
              <span>{selectedCandidates.length} Selected</span>
            </div>
            <div className="text-slate-400 text-[10px]">Candidates matched for evaluation</div>
          </div>
          <Link
            to={`/compare?jobId=${selectedJobId}&ids=${selectedCandidates.join(',')}`}
            className="px-4 py-2 bg-gradient-to-r from-brand-500 to-indigo-500 hover:from-brand-600 hover:to-indigo-600 text-xs font-bold text-slate-100 rounded-xl transition shadow-lg flex items-center"
          >
            Compare Profiles
          </Link>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
