import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';

const UploadDropzone = ({ 
  selectedJobId, 
  uploadQueue, 
  setUploadQueue, 
  uploading, 
  setUploading, 
  fetchCandidates 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

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

    // Set temp upload state in queue for visual feedback
    setUploadQueue(prev => prev.map(item => 
      item.status === 'queued' ? { ...item, status: 'uploading' } : item
    ));

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
          // If was uploading but not matched, restore or set error
          if (item.status === 'uploading') {
            return { ...item, status: 'error', error: 'Upload failed' };
          }
          return item;
        });
      });

      fetchCandidates();

    } catch (err) {
      console.error(err);
      alert('Batch upload processing failure.');
      setUploadQueue(prev => prev.map(item => 
        item.status === 'uploading' ? { ...item, status: 'error', error: 'Upload failed' } : item
      ));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Area */}
      <div 
        className={`glass-panel border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-[220px] ${
          dragActive 
            ? 'border-brand-500 bg-brand-600/5 glow-accent-indigo scale-[1.01]' 
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/10 hover:bg-slate-900/20'
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
        <div className={`p-4 bg-slate-950/60 rounded-full border border-slate-850 mb-3 shadow-inner transition-transform duration-300 ${dragActive ? 'animate-bounce text-brand-400' : 'text-indigo-400 hover:scale-115'}`}>
          <Upload className={`h-8 w-8 ${!dragActive && 'animate-pulse'}`} />
        </div>
        <p className="text-sm font-bold text-slate-200">Drag and drop resumes here</p>
        <p className="text-xs text-slate-500 mt-1">or click to browse local files</p>
        <span className="text-[9px] text-indigo-400 bg-indigo-950/30 border border-indigo-900/50 px-2 py-0.5 rounded-full mt-4 uppercase tracking-widest font-bold">
          PDF, DOCX, TXT (Max 10MB)
        </span>
      </div>

      {/* Upload Queue list */}
      {uploadQueue.length > 0 && (
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl bg-slate-900/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider">Upload queue ({uploadQueue.length} files)</h4>
            <button
              onClick={uploadQueuedFiles}
              disabled={uploading || !uploadQueue.some(i => i.status === 'queued')}
              className="px-3.5 py-1.5 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 disabled:opacity-50 text-xs font-bold text-slate-100 rounded-xl transition shadow-md active:scale-95"
            >
              {uploading ? (
                <span className="flex items-center space-x-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Processing...</span>
                </span>
              ) : 'Run Analysis'}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1">
            {uploadQueue.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-slate-950/40 border border-slate-900 rounded-xl text-xs hover:border-slate-800 transition-colors">
                <div className="flex items-center space-x-2.5 truncate pr-2">
                  <div className="p-1 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0">
                    <FileText className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="truncate">
                    <span className="text-slate-300 font-semibold truncate block" title={item.name}>{item.name}</span>
                    <span className="text-[10px] text-slate-500 block">({item.size})</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2.5 flex-shrink-0">
                  {item.status === 'accepted' && <CheckCircle2 className="h-4 w-4 text-emerald-500 shadow-sm" />}
                  {item.status === 'error' && (
                    <span className="text-[10px] text-rose-400 font-bold max-w-[100px] truncate" title={item.error}>
                      {item.error}
                    </span>
                  )}
                  {item.status === 'queued' && (
                    <span className="text-indigo-400 text-[9px] bg-indigo-950/50 border border-indigo-900/60 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      Queued
                    </span>
                  )}
                  {item.status === 'uploading' && (
                    <span className="text-blue-400 text-[9px] bg-blue-950/50 border border-blue-900/60 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center space-x-1">
                      <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                      <span>Uploading</span>
                    </span>
                  )}
                  {item.status === 'accepted' && (
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center space-x-1 ${
                      item.processingStatus === 'Parsed' 
                        ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-900/50' 
                        : item.processingStatus === 'Failed'
                          ? 'text-rose-400 bg-rose-950/50 border border-rose-900/50'
                          : 'text-amber-400 bg-amber-950/50 border border-amber-900/50'
                    }`}>
                      {['Pending', 'Processing'].includes(item.processingStatus) && (
                        <RefreshCw className="h-2.5 w-2.5 animate-spin text-amber-400" />
                      )}
                      <span>{item.processingStatus || 'Accepted'}</span>
                    </span>
                  )}
                  <button onClick={() => removeQueueItem(item.id)} className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-900/80 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadDropzone;
