import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Upload, Briefcase, FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Trash2, ShieldAlert, Sparkles, Scale, Filter, ChevronDown, Check, AlertTriangle, ShieldCheck
} from 'lucide-react';

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

  // Phase 5 advanced filters state
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [selectedRecs, setSelectedRecs] = useState([]);
  const [skillsFilter, setSkillsFilter] = useState('');
  const [decisionStatusFilter, setDecisionStatusFilter] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(true);

  // Phase 5 bulk decision modal states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDecision, setBulkDecision] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [isBulkConflict, setIsBulkConflict] = useState(false);
  const [submittingBulk, setSubmittingBulk] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      const res = await axios.get('/jobs/');
      setJobs(res.data);
      
      // Parse parameters on initial load
      const params = new URLSearchParams(location.search);
      const jobIdParam = params.get('jobId');
      
      if (jobIdParam) {
        setSelectedJobId(jobIdParam);
      } else if (res.data.length > 0) {
        setSelectedJobId(res.data[0].Job_ID.toString());
      }
    } catch (err) {
      console.error('Failed to retrieve jobs', err);
    } finally {
      setJobsLoading(false);
    }
  };

  // Sync state filters with URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const jobIdParam = params.get('jobId');
    if (jobIdParam && jobIdParam !== selectedJobId) {
      setSelectedJobId(jobIdParam);
    }
    
    setMinScore(Number(params.get('min_score') || '0'));
    setMaxScore(Number(params.get('max_score') || '100'));
    
    const recParam = params.get('recommendation');
    setSelectedRecs(recParam ? recParam.split(',') : []);
    
    setSkillsFilter(params.get('skills') || '');
    setDecisionStatusFilter(params.get('decision_status') || '');
  }, [location.search]);

  const updateUrlFilters = (newMin, newMax, newRecs, newSkills, newDec, targetJobId = selectedJobId) => {
    const params = new URLSearchParams();
    if (targetJobId) params.append('jobId', targetJobId);
    if (newMin > 0) params.append('min_score', newMin);
    if (newMax < 100) params.append('max_score', newMax);
    if (newRecs && newRecs.length > 0) params.append('recommendation', newRecs.join(','));
    if (newSkills) params.append('skills', newSkills);
    if (newDec) params.append('decision_status', newDec);
    
    navigate(`/upload?${params.toString()}`, { replace: true });
  };

  const fetchCandidates = async () => {
    if (!selectedJobId) return;
    try {
      setCandidatesLoading(true);
      const params = new URLSearchParams();
      if (minScore > 0) params.append('min_score', minScore);
      if (maxScore < 100) params.append('max_score', maxScore);
      if (selectedRecs.length > 0) params.append('recommendation', selectedRecs.join(','));
      if (skillsFilter) params.append('skills', skillsFilter);
      if (decisionStatusFilter) params.append('decision_status', decisionStatusFilter);
      
      const res = await axios.get(`/candidates/job/${selectedJobId}?${params.toString()}`);
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
  }, [selectedJobId, minScore, maxScore, selectedRecs, skillsFilter, decisionStatusFilter]);

  useEffect(() => {
    if (!selectedJobId || !candidates.some(c => ['Pending', 'Processing'].includes(c.Processing_Status))) {
      return undefined;
    }

    const refreshTimer = setInterval(fetchCandidates, 3000);
    return () => clearInterval(refreshTimer);
  }, [selectedJobId, candidates]);

  useEffect(() => {
    const activeItems = uploadQueue.filter(item => item.processingId && item.processingStatus !== 'COMPLETED' && item.processingStatus !== 'FAILED');
    if (activeItems.length === 0) return undefined;

    const refreshStatuses = async () => {
      const updates = await Promise.all(activeItems.map(async item => {
        try {
          const response = await axios.get(`/candidates/processing/${item.processingId}`);
          return [item.processingId, response.data];
        } catch {
          return null;
        }
      }));
      const validUpdates = updates.filter(Boolean);
      if (validUpdates.length > 0) {
        setUploadQueue(prev => prev.map(item => {
          const update = validUpdates.find(([id]) => id === item.processingId);
          return update ? { ...item, processingStatus: update[1].Status, status: update[1].Status === 'FAILED' ? 'error' : 'accepted', error: update[1].Error_Message || '' } : item;
        }));
        fetchCandidates();
      }
    };

    refreshStatuses();
    const refreshTimer = setInterval(refreshStatuses, 3000);
    return () => clearInterval(refreshTimer);
  }, [uploadQueue]);

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
      alert('Please select a target job first.');
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
      
      setUploadQueue(prev => {
        return prev.map(item => {
          const match = results.find(r => r.filename === item.name);
          if (match) {
            return {
              ...item,
              status: match.error ? 'error' : 'accepted',
              error: match.error || '',
              processingId: match.processing_id,
              candidateId: match.candidate_id,
              processingStatus: match.processing_status
            };
          }
          return item;
        });
      });

      fetchCandidates();

    } catch (err) {
      console.error(err);
      alert('Batch upload processing failure.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectCandidate = (candidateId) => {
    setSelectedCandidates(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      } else {
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

  // Open Bulk decision override dialog checks for conflicts
  const openBulkDecisionModal = (decisionType) => {
    const selectedCands = candidates.filter(c => selectedCandidates.includes(c.Candidate_ID));
    
    // Evaluate conflict batch-wise
    let conflict = false;
    selectedCands.forEach(c => {
      // Threshold recommendation check: we check if cand has low/strong score matching
      const score = c.Overall_Score || 0;
      let rec = 'Low Match';
      if (selectedJob) {
        if (score >= selectedJob.Strong_Threshold) rec = 'Strong Match';
        else if (score >= selectedJob.Good_Threshold) rec = 'Good Match';
        else if (score >= selectedJob.Potential_Threshold) rec = 'Potential Match';
      }
      
      if (rec === 'Low Match' && ['Shortlist', 'Interview', 'Select'].includes(decisionType)) {
        conflict = true;
      } else if (rec === 'Strong Match' && decisionType === 'Reject') {
        conflict = true;
      }
    });

    setBulkDecision(decisionType);
    setIsBulkConflict(conflict);
    setBulkReason('');
    setShowBulkModal(true);
  };

  const handleBulkDecisionSubmit = async (e) => {
    e.preventDefault();
    if (isBulkConflict && (!bulkReason || bulkReason.trim().length < 3)) {
      alert('Justification explanation is mandatory for conflicting overrides.');
      return;
    }

    setSubmittingBulk(true);
    try {
      const payload = {
        Candidate_IDs: selectedCandidates,
        Decision: bulkDecision,
        Reason: bulkReason.trim() || null
      };

      await axios.post('/candidates/bulk-decision', payload);
      alert(`Recruiter decision logged successfully for ${selectedCandidates.length} candidates.`);
      setSelectedCandidates([]);
      setShowBulkModal(false);
      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to submit bulk recruiter override.');
    } finally {
      setSubmittingBulk(false);
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (minScore > 0 || maxScore < 100) count++;
    if (selectedRecs.length > 0) count++;
    if (skillsFilter) count++;
    if (decisionStatusFilter) count++;
    return count;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
          <Upload className="h-5 w-5 text-indigo-400" />
          <span>Resume Screening</span>
        </h2>
        <p className="text-xs text-slate-400">
          Upload resumes and calculate match scores dynamically based on job parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Target Position Selection card */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
              <Briefcase className="h-4.5 w-4.5 text-brand-400" />
              <span>Target Job</span>
            </h3>
            
            {jobsLoading ? (
              <div className="text-xs text-slate-500 flex items-center space-x-2">
                <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                <span>Loading roles...</span>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-xs text-amber-400">No active jobs. Create a job first.</div>
            ) : (
              <select
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  updateUrlFilters(minScore, maxScore, selectedRecs, skillsFilter, decisionStatusFilter, e.target.value);
                }}
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
            <p className="text-xs font-semibold text-slate-200">Drag and drop resumes here</p>
            <p className="text-[10px] text-slate-500 mt-1">or click to browse local files</p>
            <span className="text-[9px] text-indigo-500/80 mt-4 uppercase tracking-widest font-semibold">PDF, DOCX, TXT (Max 10MB)</span>
          </div>

          {/* Upload Queue list */}
          {uploadQueue.length > 0 && (
            <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="text-xs font-semibold text-slate-300">Upload queue</h4>
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
                      {item.status === 'accepted' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {item.status === 'error' && (
                        <span className="text-[9px] text-rose-400 font-semibold max-w-[80px] truncate" title={item.error}>
                          {item.error}
                        </span>
                      )}
                      {item.status === 'queued' && <span className="text-indigo-400 text-[8px] font-bold uppercase">Queued</span>}
                      {item.status === 'accepted' && <span className="text-emerald-400 text-[8px] font-bold uppercase">{item.processingStatus || 'Accepted for processing'}</span>}
                      {item.status === 'error' && item.processingId && <span className="text-rose-400 text-[8px] font-bold uppercase">Processing failed</span>}
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

        {/* Right Column: Candidates Directory Table */}
        <div className="lg:col-span-2 space-y-4">
          
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
            
            {/* Table Header toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-3">
              <div className="flex items-center space-x-3">
                <FileText className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
                <h3 className="font-semibold text-slate-100">Candidates Directory</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowFilterBar(!showFilterBar)}
                  className={`px-2.5 py-1 border rounded-lg text-[10px] font-bold transition flex items-center space-x-1 ${
                    getActiveFilterCount() > 0 
                      ? 'border-indigo-500 bg-indigo-950/20 text-indigo-300' 
                      : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 bg-slate-900/60'
                  }`}
                >
                  <Filter className="h-3 w-3" />
                  <span>Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}</span>
                </button>
                {candidates.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                    title="Export all screening scores to CSV"
                  >
                    <span>Export CSV</span>
                  </button>
                )}
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-semibold">
                  Total: {candidates.length}
                </span>
              </div>
            </div>

            {/* Filter Bar (Phase 5) */}
            {showFilterBar && (
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 mb-5 space-y-4 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="font-bold text-slate-300 flex items-center">
                    <Filter className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                    <span>Search Criteria</span>
                  </span>
                  {getActiveFilterCount() > 0 && (
                    <button 
                      onClick={() => {
                        setMinScore(0);
                        setMaxScore(100);
                        setSelectedRecs([]);
                        setSkillsFilter('');
                        setDecisionStatusFilter('');
                        updateUrlFilters(0, 100, [], '', '');
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Score range */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Score Range ({minScore}% - {maxScore}%)</label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={minScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMinScore(val);
                          updateUrlFilters(val, maxScore, selectedRecs, skillsFilter, decisionStatusFilter);
                        }}
                        className="w-1/2 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={maxScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMaxScore(val);
                          updateUrlFilters(minScore, val, selectedRecs, skillsFilter, decisionStatusFilter);
                        }}
                        className="w-1/2 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>

                  {/* RecommendationChips */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">AI Match Recommendation</label>
                    <div className="flex flex-wrap gap-1">
                      {['Strong Match', 'Good Match', 'Potential Match', 'Low Match'].map(rec => {
                        const isSelected = selectedRecs.includes(rec);
                        return (
                          <button
                            key={rec}
                            onClick={() => {
                              const newRecs = isSelected 
                                ? selectedRecs.filter(r => r !== rec)
                                : [...selectedRecs, rec];
                              setSelectedRecs(newRecs);
                              updateUrlFilters(minScore, maxScore, newRecs, skillsFilter, decisionStatusFilter);
                            }}
                            className={`px-2 py-0.5 rounded text-[8px] font-bold border transition ${
                              isSelected 
                                ? 'bg-indigo-950/65 border-indigo-500 text-indigo-400 font-bold' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            {rec.replace(' Match', '')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skills input */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Skills Search</label>
                    <div className="flex flex-wrap gap-1 max-h-[36px] overflow-y-auto mb-1.5 pr-1">
                      {selectedJob?.Required_Skills?.concat(selectedJob?.Preferred_Skills || [])?.slice(0, 6).map(sk => {
                        const isSelected = skillsFilter.toLowerCase().includes(sk.toLowerCase());
                        return (
                          <button
                            key={sk}
                            onClick={() => {
                              let newSkills = skillsFilter;
                              if (isSelected) {
                                newSkills = skillsFilter.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== sk.toLowerCase()).join(',');
                              } else {
                                newSkills = skillsFilter ? `${skillsFilter}, ${sk}` : sk;
                              }
                              setSkillsFilter(newSkills);
                              updateUrlFilters(minScore, maxScore, selectedRecs, newSkills, decisionStatusFilter);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[7px] border transition ${
                              isSelected
                                ? 'bg-emerald-950/60 border-emerald-505 text-emerald-400 font-bold'
                                : 'bg-slate-900 border-slate-850 text-slate-400 hover:border-slate-750'
                            }`}
                          >
                            {sk}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={skillsFilter}
                      onChange={(e) => {
                        setSkillsFilter(e.target.value);
                        updateUrlFilters(minScore, maxScore, selectedRecs, e.target.value, decisionStatusFilter);
                      }}
                      placeholder="Search tags comma-separated..."
                      className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded px-2 py-1 text-[9px] outline-none text-slate-200"
                    />
                  </div>

                  {/* Decision select */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Recruiter decision</label>
                    <select
                      value={decisionStatusFilter}
                      onChange={(e) => {
                        setDecisionStatusFilter(e.target.value);
                        updateUrlFilters(minScore, maxScore, selectedRecs, skillsFilter, e.target.value);
                      }}
                      className="w-full px-2.5 py-1 bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded text-[10px] outline-none text-slate-200"
                    >
                      <option value="">All Decisions</option>
                      <option value="No Decision">Awaiting Review</option>
                      <option value="Shortlist">Shortlisted</option>
                      <option value="Interview">Interviewing</option>
                      <option value="Hold">On Hold</option>
                      <option value="Reject">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {candidatesLoading ? (
              <div className="text-center py-12 text-xs text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-650" />
                <span>Syncing directory search results...</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 italic border border-slate-900 rounded-xl bg-slate-950/20">
                No matching candidate profiles found. Click "Clear Filters" or ingest new resumes.
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
                        <td className="py-3 text-slate-450 max-w-[140px] truncate" title={cand.Resume_File_Path.split(/[\\/]/).pop()}>
                          {cand.Resume_File_Path.split(/[\\/]/).pop()}
                        </td>
                        <td className="py-3 text-slate-500">
                          {new Date(cand.Upload_Date).toLocaleDateString()}
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

      {/* Extended Floating Action Drawer (Compare & Bulk Actions) */}
      {selectedCandidates.length >= 1 && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-40 bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row md:items-center gap-3 md:gap-0 md:space-x-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-xs flex justify-between items-center md:block">
            <div className="font-bold text-slate-100 flex items-center space-x-1">
              <Scale className="h-3.5 w-3.5 text-indigo-400" />
              <span>{selectedCandidates.length} Selected</span>
            </div>
            <div className="text-slate-400 text-[10px] md:mt-0.5">Compare candidates or update the decision</div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-3 justify-end w-full md:w-auto">
            {selectedCandidates.length >= 2 && (
              <Link
                to={`/compare?jobId=${selectedJobId}&ids=${selectedCandidates.join(',')}`}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 rounded-lg transition"
              >
                Compare ({selectedCandidates.length})
              </Link>
            )}
            
            <button
              onClick={() => openBulkDecisionModal('Shortlist')}
              className="px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-700 hover:border-emerald-600 text-xs font-semibold text-emerald-250 rounded-lg transition"
            >
              Shortlist Selected
            </button>
            <button
              onClick={() => openBulkDecisionModal('Reject')}
              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-900/50 text-xs font-semibold text-rose-300 rounded-lg transition"
            >
              Reject Selected
            </button>
            <button
              onClick={() => openBulkDecisionModal('Hold')}
              className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-950 border border-amber-900/50 text-xs font-semibold text-amber-300 rounded-lg transition"
            >
              Hold Selected
            </button>
          </div>
        </div>
      )}

      {/* Recruiter Bulk Decision Justification Reason Dialog (Phase 5) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-md font-bold text-slate-100 flex items-center space-x-2">
                {isBulkConflict ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-500 animate-bounce" />
                    <span>AI Recommendation Conflict Warning</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 text-indigo-400" />
                    <span>Confirm Bulk Review Decision</span>
                  </>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isBulkConflict 
                  ? `Your bulk decision to '${bulkDecision}' selected candidates contradicts the AI matching suggestions for one or more profiles. A mandatory justification reason is required.`
                  : `This action will set the recruiter decision to '${bulkDecision}' for the ${selectedCandidates.length} selected candidate profiles.`}
              </p>
            </div>
            
            <form onSubmit={handleBulkDecisionSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                  Justification reason {isBulkConflict && '(Mandatory)'}
                </label>
                <textarea
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Explain why you are overriding the AI recommendation..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-slate-100 outline-none text-xs min-h-[90px]"
                  required={isBulkConflict}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => { setShowBulkModal(false); setBulkReason(''); }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBulk}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {submittingBulk ? 'Saving decisions...' : 'Confirm decisions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default UploadPage;
