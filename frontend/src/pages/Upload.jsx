import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Upload, Briefcase, FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

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

  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      const res = await axios.get('/jobs/');
      setJobs(res.data);
      if (res.data.length > 0) {
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
    fetchCandidates();
  }, [selectedJobId]);

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
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      let error = null;

      if (!validExtensions.includes(ext)) {
        error = 'Invalid type. Only PDF, DOCX, and TXT files are accepted.';
      } else if (file.size > maxSizeBytes) {
        error = 'Oversized file. Maximum limit is 10MB.';
      }

      newQueue.push({
        file,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        error,
        status: error ? 'Rejected' : 'Queued'
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

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const clearQueueItem = (idx) => {
    setUploadQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const clearQueue = () => {
    setUploadQueue([]);
  };

  const handleUploadSubmit = async () => {
    if (!selectedJobId) {
      alert('Please select a target job position first.');
      return;
    }

    const itemsToUpload = uploadQueue.filter(item => item.status === 'Queued');
    if (itemsToUpload.length === 0) {
      alert('No valid files in the queue to upload.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    itemsToUpload.forEach(item => {
      formData.append('files', item.file);
    });

    try {
      const response = await axios.post(`/candidates/upload/${selectedJobId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Map response results back to our queue
      const results = response.data.results;
      const updatedQueue = [...uploadQueue];
      
      results.forEach(res => {
        const queueIdx = updatedQueue.findIndex(item => item.name === res.filename);
        if (queueIdx !== -1) {
          if (res.status === 'Uploaded') {
            updatedQueue[queueIdx].status = 'Success';
            updatedQueue[queueIdx].processing_status = res.processing_status;
            updatedQueue[queueIdx].error = res.error; // Displays corruption warning
          } else {
            updatedQueue[queueIdx].status = 'Failed';
            updatedQueue[queueIdx].error = res.error;
          }
        }
      });

      setUploadQueue(updatedQueue);
      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert('Failed to upload resumes. Ensure files do not exceed payload restrictions.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Resume Processing</h2>
        <p className="text-sm text-slate-400 mt-1">Upload resumes in batch, perform size validations, and catalog applicants.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Zone & Queue */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
              <Briefcase className="h-4.5 w-4.5 text-brand-400" />
              <span>Target Position</span>
            </h3>
            
            {jobsLoading ? (
              <div className="text-xs text-slate-500">Loading roles...</div>
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
            <div className="h-11 w-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
              <Upload className="h-5 w-5 text-brand-400 animate-pulse" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">Drag and drop resumes here</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Supports PDF, DOCX, or TXT formats up to 10MB.</p>
            <button
              type="button"
              className="mt-4 text-xs font-semibold text-brand-400 hover:text-brand-300"
            >
              Or browse files manually
            </button>
          </div>
        </div>

        {/* Queue List & Candidates table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Queue */}
          {uploadQueue.length > 0 && (
            <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
                  <FileText className="h-4.5 w-4.5 text-indigo-400" />
                  <span>Upload Queue ({uploadQueue.length})</span>
                </h3>
                <div className="flex space-x-3">
                  <button
                    onClick={clearQueue}
                    disabled={uploading}
                    className="text-xs font-medium text-slate-500 hover:text-slate-300 disabled:opacity-50"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleUploadSubmit}
                    disabled={uploading || !uploadQueue.some(item => item.status === 'Queued')}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <span>Start Upload Batch</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {uploadQueue.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-900/50 border border-slate-900 p-3 rounded-xl">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 flex-shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-200 truncate pr-2" title={item.name}>{item.name}</h4>
                        <span className="text-[10px] text-slate-500">{item.size}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {item.status === 'Queued' && (
                        <span className="text-[10px] font-semibold text-slate-400 border border-slate-800 bg-slate-900 px-2 py-0.5 rounded-md">
                          Ready
                        </span>
                      )}
                      {item.status === 'Rejected' && (
                        <span className="text-[10px] font-semibold text-red-400 border border-red-950/60 bg-red-950/20 px-2 py-0.5 rounded-md flex items-center space-x-1" title={item.error}>
                          <XCircle className="h-3 w-3" />
                          <span>Invalid File</span>
                        </span>
                      )}
                      {item.status === 'Success' && !item.error && (
                        <span className="text-[10px] font-semibold text-emerald-400 border border-emerald-950/60 bg-emerald-950/20 px-2 py-0.5 rounded-md flex items-center space-x-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Success</span>
                        </span>
                      )}
                      {item.status === 'Success' && item.error && (
                        <span className="text-[10px] font-semibold text-amber-400 border border-amber-950/60 bg-amber-950/20 px-2 py-0.5 rounded-md flex items-center space-x-1" title={item.error}>
                          <AlertCircle className="h-3 w-3" />
                          <span>Corrupted</span>
                        </span>
                      )}
                      {item.status === 'Failed' && (
                        <span className="text-[10px] font-semibold text-red-400 border border-red-950/60 bg-red-950/20 px-2 py-0.5 rounded-md flex items-center space-x-1" title={item.error}>
                          <XCircle className="h-3 w-3" />
                          <span>Failed</span>
                        </span>
                      )}
                      
                      <button
                        onClick={() => clearQueueItem(idx)}
                        disabled={uploading}
                        className="text-slate-500 hover:text-slate-300 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Candidates catalog table */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
                <FileText className="h-4.5 w-4.5 text-indigo-400" />
                <span>Uploaded Candidates</span>
              </h3>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-semibold">
                Total: {candidates.length}
              </span>
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
                      <th className="pb-3 font-semibold">Candidate Name</th>
                      <th className="pb-3 font-semibold">Filename</th>
                      <th className="pb-3 font-semibold">Upload Date</th>
                      <th className="pb-3 font-semibold text-center">Match Score</th>
                      <th className="pb-3 font-semibold text-right">Integrity Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((cand) => (
                      <tr key={cand.Candidate_ID} className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/20">
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
    </div>
  );
};

export default UploadPage;
