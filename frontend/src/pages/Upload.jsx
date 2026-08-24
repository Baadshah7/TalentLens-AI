import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Upload, Briefcase, FileText, Scale, AlertTriangle, ShieldCheck, RefreshCw, CheckCircle2 
} from 'lucide-react';
import UploadDropzone from '../components/UploadDropzone';
import SearchCriteriaPanel from '../components/SearchCriteriaPanel';
import CandidatesTable from '../components/CandidatesTable';

const UploadPage = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [totalCandidatesCount, setTotalCandidatesCount] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Queue list state
  const [uploadQueue, setUploadQueue] = useState([]);

  // Bulk overrides selection state
  const [selectedCandidates, setSelectedCandidates] = useState([]);

  // Search filters state
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [selectedRecs, setSelectedRecs] = useState([]);
  const [skillsFilter, setSkillsFilter] = useState('');
  const [decisionStatusFilter, setDecisionStatusFilter] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(true);

  // Bulk overrides decision modal states
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

  const fetchTotalCount = async () => {
    if (!selectedJobId) return;
    try {
      const res = await axios.get(`/candidates/job/${selectedJobId}`);
      setTotalCandidatesCount(res.data.length);
    } catch (err) {
      console.error('Failed to retrieve total count', err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    setSelectedCandidates([]);
    fetchCandidates();
    fetchTotalCount();
  }, [selectedJobId, minScore, maxScore, selectedRecs, skillsFilter, decisionStatusFilter]);

  // Sync count on queue change (finished processes)
  useEffect(() => {
    fetchTotalCount();
  }, [uploadQueue]);

  useEffect(() => {
    if (!selectedJobId || !candidates.some(c => ['Pending', 'Processing'].includes(c.Processing_Status))) {
      return undefined;
    }

    const refreshTimer = setInterval(() => {
      fetchCandidates();
      fetchTotalCount();
    }, 3000);
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
        fetchTotalCount();
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

  const openBulkDecisionModal = (decisionType) => {
    const selectedCands = candidates.filter(c => selectedCandidates.includes(c.Candidate_ID));
    
    let conflict = false;
    selectedCands.forEach(c => {
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
      fetchTotalCount();
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
    <div className="p-6 md:p-8 space-y-10">
      {/* Page Title */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-5">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center space-x-3">
            <Upload className="h-7 w-7 text-indigo-400" />
            <span>Resume Screening</span>
          </h2>
          <p className="text-sm text-slate-450">
            Upload resumes and calculate match scores dynamically based on job parameters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-1 space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
          
          {/* Grouped Screening Configuration Card */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl shadow-xl bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col justify-between">
            <div className="p-6 space-y-6">
              <h3 className="font-semibold text-slate-100 text-base flex items-center space-x-2 border-b border-slate-850 pb-3">
                <Briefcase className="h-4.5 w-4.5 text-brand-400" />
                <span>Screening Configuration</span>
              </h3>
              
              {/* PRIMARY: Target Job Select */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Target Job Position</label>
                {jobsLoading ? (
                  <div className="text-xs text-slate-500 flex items-center space-x-2 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
                    <span>Loading roles...</span>
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="text-xs text-amber-400 bg-amber-950/10 border border-amber-900/20 p-3 rounded-xl">No active jobs found. Please create a job first.</div>
                ) : (
                  <select
                    value={selectedJobId}
                    onChange={(e) => {
                      setSelectedJobId(e.target.value);
                      updateUrlFilters(minScore, maxScore, selectedRecs, skillsFilter, decisionStatusFilter, e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-150 outline-none transition text-sm font-semibold shadow-inner"
                  >
                    {jobs.map(j => (
                      <option key={j.Job_ID} value={j.Job_ID}>{j.Job_Title} ({j.Department})</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedJob && (
                <div className="space-y-4">
                  {/* SECONDARY: Blind Screening Mode Toggle */}
                  <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-xl border border-slate-900/60 shadow-inner">
                    <div className="text-xs text-slate-450 pr-2">
                      <div className="font-bold text-slate-200 text-xs">Blind Screening Mode</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">Mask candidate name and contact info</div>
                    </div>
                    <button
                      onClick={toggleBlindMode}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shadow-sm ${
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
                </div>
              )}
            </div>

            {selectedJob && (
              /* COMPACT TRUST BADGE BANNER */
              <div className="flex items-center space-x-2 text-[10px] text-emerald-450 bg-emerald-950/20 border-t border-slate-900/60 py-2.5 px-6 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                <span>Ethical Screening Enforced (Protected attributes redacted)</span>
              </div>
            )}
          </div>

          {/* Action: Upload Zone component */}
          <UploadDropzone
            selectedJobId={selectedJobId}
            uploadQueue={uploadQueue}
            setUploadQueue={setUploadQueue}
            uploading={uploading}
            setUploading={setUploading}
            fetchCandidates={fetchCandidates}
          />
        </div>

        {/* Right Column: Candidates Directory Table */}
        <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          
          {/* Candidates Directory Wrapper Card */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 shadow-xl bg-slate-900/40 backdrop-blur-md">
            
            {/* Table Header toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-850 pb-4 mb-5 gap-3">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-indigo-400 animate-pulse" />
                <h3 className="font-semibold text-slate-100 text-lg">Candidates Directory</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowFilterBar(!showFilterBar)}
                  className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm active:scale-95 ${
                    getActiveFilterCount() > 0 
                      ? 'border-indigo-500 bg-indigo-950/20 text-indigo-300' 
                      : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 bg-slate-900/60'
                  }`}
                >
                  <span>Filters</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${getActiveFilterCount() > 0 ? 'bg-indigo-500 text-slate-100' : 'bg-slate-800 text-slate-500'}`}>
                    {getActiveFilterCount()}
                  </span>
                </button>
                {candidates.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                    title="Export all screening scores to CSV"
                  >
                    <span>Export CSV</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Filter Panel */}
            {showFilterBar && (
              <div className="mb-6">
                <SearchCriteriaPanel
                  selectedJob={selectedJob}
                  minScore={minScore}
                  maxScore={maxScore}
                  setMinScore={setMinScore}
                  setMaxScore={setMaxScore}
                  selectedRecs={selectedRecs}
                  setSelectedRecs={setSelectedRecs}
                  skillsFilter={skillsFilter}
                  setSkillsFilter={setSkillsFilter}
                  decisionStatusFilter={decisionStatusFilter}
                  setDecisionStatusFilter={setDecisionStatusFilter}
                  updateUrlFilters={updateUrlFilters}
                  getActiveFilterCount={getActiveFilterCount}
                />
              </div>
            )}

            {/* Candidates Table Component */}
            <CandidatesTable
              candidates={candidates}
              totalCandidatesCount={totalCandidatesCount}
              selectedCandidates={selectedCandidates}
              handleSelectCandidate={handleSelectCandidate}
              selectedJobId={selectedJobId}
              selectedJob={selectedJob}
              candidatesLoading={candidatesLoading}
              getActiveFilterCount={getActiveFilterCount}
            />

          </div>
        </div>
      </div>

      {/* Floating Action Drawer for Compare / Bulk decisions */}
      {selectedCandidates.length >= 1 && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:bottom-8 z-40 bg-slate-900/90 backdrop-blur-md border border-indigo-500/35 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center gap-4 md:space-x-6 animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div className="text-xs">
            <div className="font-extrabold text-slate-100 flex items-center space-x-1.5">
              <Scale className="h-4 w-4 text-indigo-400" />
              <span className="text-sm">{selectedCandidates.length} Selected Profiles</span>
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5">Compare fit scores or override recruiter decisions in batch</div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-5 justify-end w-full md:w-auto">
            {selectedCandidates.length >= 2 && (
              <Link
                to={`/compare?jobId=${selectedJobId}&ids=${selectedCandidates.join(',')}`}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-xs font-bold text-slate-200 rounded-xl transition shadow-md"
              >
                Compare ({selectedCandidates.length})
              </Link>
            )}
            
            <button
              onClick={() => openBulkDecisionModal('Shortlist')}
              className="px-4 py-2 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 hover:border-emerald-700 text-xs font-bold text-emerald-400 rounded-xl transition shadow-md"
            >
              Shortlist Selected
            </button>
            <button
              onClick={() => openBulkDecisionModal('Reject')}
              className="px-4 py-2 bg-rose-955 hover:bg-rose-900 border border-rose-900/50 text-xs font-bold text-rose-300 rounded-xl transition shadow-md"
            >
              Reject Selected
            </button>
            <button
              onClick={() => openBulkDecisionModal('Hold')}
              className="px-4 py-2 bg-amber-955 hover:bg-amber-950 border border-amber-900/50 text-xs font-bold text-amber-300 rounded-xl transition shadow-md"
            >
              Hold Selected
            </button>
          </div>
        </div>
      )}

      {/* Recruiter Overrides Override Confirmation Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1.5">
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
              <p className="text-xs text-slate-400 leading-relaxed">
                {isBulkConflict 
                  ? `Your bulk decision to '${bulkDecision}' selected candidates contradicts the AI matching suggestions for one or more profiles. A mandatory justification reason is required.`
                  : `This action will set the recruiter decision to '${bulkDecision}' for the ${selectedCandidates.length} selected candidate profiles.`}
              </p>
            </div>
            
            <form onSubmit={handleBulkDecisionSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">
                  Justification reason {isBulkConflict && '(Required)'}
                </label>
                <textarea
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Explain why you are overriding the AI matching recommendations..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none text-xs min-h-[90px] shadow-inner"
                  required={isBulkConflict}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-850 text-xs">
                <button
                  type="button"
                  onClick={() => { setShowBulkModal(false); setBulkReason(''); }}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBulk}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-550 text-slate-150 rounded-xl font-bold transition disabled:opacity-50 shadow-md"
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
