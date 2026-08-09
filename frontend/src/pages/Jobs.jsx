import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Briefcase, MapPin, Building, Calendar, Plus, Edit2, Trash2, X, Info, Sparkles, Scale, AlertCircle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const DEFAULT_WEIGHTS = {
  required_skills: 35,
  preferred_skills: 15,
  experience: 15,
  education: 10,
  projects: 10,
  certifications: 5,
  completeness: 5,
  semantic_fit: 5
};

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editJobId, setEditJobId] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('Full-time');
  const [minExp, setMinExp] = useState(0);
  const [minEd, setMinEd] = useState("Bachelor's");
  const [description, setDescription] = useState('');
  const [reqSkills, setReqSkills] = useState('');
  const [prefSkills, setPrefSkills] = useState('');
  const [certifications, setCertifications] = useState('');
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  
  // Phase 3 Thresholds
  const [strongThreshold, setStrongThreshold] = useState(85.0);
  const [goodThreshold, setGoodThreshold] = useState(70.0);
  const [potentialThreshold, setPotentialThreshold] = useState(50.0);

  // What-If Analysis state
  const [showWhatIfModal, setShowWhatIfModal] = useState(false);
  const [whatIfJob, setWhatIfJob] = useState(null);
  const [whatIfWeights, setWhatIfWeights] = useState({});
  const [whatIfRequired, setWhatIfRequired] = useState([]);
  const [whatIfPreferred, setWhatIfPreferred] = useState([]);
  const [whatIfResults, setWhatIfResults] = useState([]);
  const [runningWhatIf, setRunningWhatIf] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/jobs/');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch job postings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const openCreateModal = () => {
    setEditJobId(null);
    setTitle('');
    setDepartment('');
    setLocation('');
    setJobType('Full-time');
    setMinExp(0);
    setMinEd("Bachelor's");
    setDescription('');
    setReqSkills('');
    setPrefSkills('');
    setCertifications('');
    setWeights({ ...DEFAULT_WEIGHTS });
    setStrongThreshold(85.0);
    setGoodThreshold(70.0);
    setPotentialThreshold(50.0);
    setShowModal(true);
  };

  const openEditModal = (job) => {
    setEditJobId(job.Job_ID);
    setTitle(job.Job_Title);
    setDepartment(job.Department);
    setLocation(job.Location);
    setJobType(job.Job_Type);
    setMinExp(job.Min_Experience);
    setMinEd(job.Min_Education || "Bachelor's");
    setDescription(job.Description);
    setReqSkills(job.Required_Skills.join(', '));
    setPrefSkills(job.Preferred_Skills.join(', '));
    setCertifications(job.Certifications.join(', '));
    setStrongThreshold(job.Strong_Threshold ?? 85.0);
    setGoodThreshold(job.Good_Threshold ?? 70.0);
    setPotentialThreshold(job.Potential_Threshold ?? 50.0);
    
    const wMap = { ...DEFAULT_WEIGHTS };
    if (job.weights && job.weights.length > 0) {
      job.weights.forEach(w => {
        wMap[w.Category] = w.Weight;
      });
    }
    setWeights(wMap);
    setShowModal(true);
  };

  const handleWeightChange = (category, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setWeights(prev => ({ ...prev, [category]: num }));
  };

  const handleWeightTotal = () => {
    return Object.values(weights).reduce((a, b) => a + b, 0);
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job posting? All candidate records associated will be permanently removed.')) return;
    try {
      await axios.delete(`/jobs/${jobId}`);
      fetchJobs();
    } catch (err) {
      console.error(err);
      alert('Failed to delete job description.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = handleWeightTotal();
    if (Math.abs(total - 100) > 0.1) {
      alert(`The sum of scoring weights must equal exactly 100%. Current total: ${total}%`);
      return;
    }

    const payload = {
      Job_Title: title,
      Department: department,
      Description: description,
      Required_Skills: reqSkills.split(',').map(s => s.trim()).filter(s => s.length > 0),
      Preferred_Skills: prefSkills.split(',').map(s => s.trim()).filter(s => s.length > 0),
      Min_Experience: parseInt(minExp) || 0,
      Min_Education: minEd,
      Certifications: certifications.split(',').map(s => s.trim()).filter(s => s.length > 0),
      Job_Type: jobType,
      Location: location,
      Weights: weights,
      Strong_Threshold: parseFloat(strongThreshold) || 85.0,
      Good_Threshold: parseFloat(goodThreshold) || 70.0,
      Potential_Threshold: parseFloat(potentialThreshold) || 50.0
    };

    try {
      if (editJobId) {
        await axios.put(`/jobs/${editJobId}`, payload);
      } else {
        await axios.post('/jobs/', payload);
      }
      setShowModal(false);
      fetchJobs();
    } catch (err) {
      console.error(err);
      alert('Failed to save job description.');
    }
  };

  // What-If Operations
  const openWhatIfModal = (job) => {
    setWhatIfJob(job);
    const wMap = {};
    job.weights.forEach(w => {
      wMap[w.Category] = w.Weight;
    });
    setWhatIfWeights(wMap);
    setWhatIfRequired([...job.Required_Skills]);
    setWhatIfPreferred([...job.Preferred_Skills]);
    setWhatIfResults([]);
    setShowWhatIfModal(true);
  };

  const handleWhatIfWeightChange = (category, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setWhatIfWeights(prev => ({ ...prev, [category]: num }));
  };

  const toggleSkillRequiredPreferred = (skill) => {
    if (whatIfRequired.includes(skill)) {
      setWhatIfRequired(prev => prev.filter(s => s !== skill));
      setWhatIfPreferred(prev => [...prev, skill]);
    } else {
      setWhatIfPreferred(prev => prev.filter(s => s !== skill));
      setWhatIfRequired(prev => [...prev, skill]);
    }
  };

  const runWhatIf = async () => {
    setRunningWhatIf(true);
    try {
      const res = await axios.post(`/jobs/${whatIfJob.Job_ID}/what-if`, {
        Weights: whatIfWeights,
        Required_Skills: whatIfRequired,
        Preferred_Skills: whatIfPreferred
      });
      setWhatIfResults(res.data.candidates);
    } catch (err) {
      console.error(err);
      alert('Recalculation failed. Verify that applicants exist for this job.');
    } finally {
      setRunningWhatIf(false);
    }
  };

  const getRankShiftIcon = (oldRank, newRank) => {
    const shift = oldRank - newRank; // e.g. 3 -> 1 is +2 rank improvement
    if (shift > 0) return <span className="inline-flex items-center text-emerald-400 font-bold"><ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />{shift}</span>;
    if (shift < 0) return <span className="inline-flex items-center text-rose-400 font-bold"><ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />{Math.abs(shift)}</span>;
    return <span className="inline-flex items-center text-slate-500"><Minus className="h-3 w-3 mr-0.5" />—</span>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Job Openings</h2>
          <p className="text-sm text-slate-400 mt-1">Manage active career roles and score weighting matrixes.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Add Position</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-400 text-sm">
          Loading positions...
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel text-center py-16 border border-slate-800 rounded-2xl">
          <Briefcase className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <h4 className="font-semibold text-slate-300">No active job listings</h4>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Create your first job posting to start uploading and evaluating candidate resumes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {jobs.map((job) => (
            <div key={job.Job_ID} className="glass-panel border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/60 transition-all">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-slate-100">{job.Job_Title}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{job.Department}</p>
                  </div>
                  <div className="flex space-x-2">
                    {/* What-If Action Button */}
                    <button
                      onClick={() => openWhatIfModal(job)}
                      className="p-1.5 border border-slate-800 rounded-lg hover:bg-indigo-950/20 hover:border-indigo-900/50 text-slate-400 hover:text-indigo-400 transition flex items-center space-x-1 text-xs"
                      title="Run What-If Preview"
                    >
                      <Scale className="h-4 w-4" />
                      <span>What-If</span>
                    </button>
                    <button
                      onClick={() => openEditModal(job)}
                      className="p-1.5 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Edit job details"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(job.Job_ID)}
                      className="p-1.5 border border-slate-800 rounded-lg hover:bg-red-950/20 hover:border-red-900/50 text-slate-400 hover:text-red-400 transition"
                      title="Delete job details"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 my-4 py-3 bg-slate-900/40 rounded-xl px-4 border border-slate-900">
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <Building className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{job.Job_Type}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="truncate">{job.Location}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Min {job.Min_Experience} yrs exp</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-3 mb-4 leading-relaxed">{job.Description}</p>

                {/* Skills tags */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-2 self-center uppercase tracking-wider">Required:</span>
                    {job.Required_Skills.map((s, i) => (
                      <span key={i} className="text-[10px] bg-indigo-950/60 border border-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                    {job.Required_Skills.length === 0 && <span className="text-[10px] text-slate-500 italic">None specified</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-2 self-center uppercase tracking-wider">Preferred:</span>
                    {job.Preferred_Skills.map((s, i) => (
                      <span key={i} className="text-[10px] bg-slate-800/80 border border-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                    {job.Preferred_Skills.length === 0 && <span className="text-[10px] text-slate-500 italic">None specified</span>}
                  </div>
                </div>
              </div>

              {/* Show aggregate weights overview */}
              <div className="border-t border-slate-800/60 mt-5 pt-4">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Scoring Matrix Weights</span>
                  <span className="text-[10px] bg-indigo-900/30 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded-md flex items-center font-bold">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Configured
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  {job.weights.map((w, idx) => (
                    <div key={idx} className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-900 text-center">
                      <span className="text-slate-500 block truncate uppercase font-medium">{w.Category.replace('_', ' ')}</span>
                      <span className="font-bold text-slate-300">{w.Weight}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form Dialog for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl glass-panel border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>{editJobId ? 'Edit Job Opening' : 'Add New Job Opening'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Primary Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Job Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Senior Software Architect"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Department</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Technology"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA (Hybrid)"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Job Type</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none transition"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Remote">Remote</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Minimum Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minExp}
                    onChange={(e) => setMinExp(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Minimum Education</label>
                  <select
                    value={minEd}
                    onChange={(e) => setMinEd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none transition"
                  >
                    <option value="High School">High School</option>
                    <option value="Associate's">Associate's Degree</option>
                    <option value="Bachelor's">Bachelor's Degree</option>
                    <option value="Master's">Master's Degree</option>
                    <option value="Ph.D.">Ph.D.</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Job Description</label>
                <textarea
                  rows="3"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize the core roles, requirements, and day-to-day operations..."
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none"
                />
              </div>

              {/* Threshold configurations */}
              <div className="border-t border-slate-800/60 pt-4 space-y-4">
                <h4 className="font-semibold text-slate-200">Decision Match Thresholds</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Strong Match Threshold</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={strongThreshold}
                      onChange={(e) => setStrongThreshold(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Good Match Threshold</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={goodThreshold}
                      onChange={(e) => setGoodThreshold(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Potential Match Threshold</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={potentialThreshold}
                      onChange={(e) => setPotentialThreshold(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Skills configurations */}
              <div className="border-t border-slate-800/60 pt-4 space-y-4">
                <h4 className="font-semibold text-slate-200">Skill Profiling & Keywords</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Required Skills (CSV)</label>
                    <textarea
                      rows="2"
                      value={reqSkills}
                      onChange={(e) => setReqSkills(e.target.value)}
                      placeholder="React, Python, SQL"
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Preferred Skills (CSV)</label>
                    <textarea
                      rows="2"
                      value={prefSkills}
                      onChange={(e) => setPrefSkills(e.target.value)}
                      placeholder="FastAPI, Docker, AWS"
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Certifications (CSV)</label>
                    <textarea
                      rows="2"
                      value={certifications}
                      onChange={(e) => setCertifications(e.target.value)}
                      placeholder="AWS Solution Architect, PMP"
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Scoring weights configurations */}
              <div className="border-t border-slate-800/60 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-slate-200">Candidate Weight Matrix</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase bg-indigo-950/60 border border-indigo-900 px-2 py-0.5 rounded-md flex items-center">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Suggested
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                      Math.abs(handleWeightTotal() - 100) < 0.1 
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900' 
                        : 'bg-red-950/60 text-red-400 border-red-900'
                    }`}>
                      Sum: {handleWeightTotal()}% / 100%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                  {Object.keys(DEFAULT_WEIGHTS).map((cat) => (
                    <div key={cat} className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate" title={cat.replace('_', ' ')}>
                        {cat.replace('_', ' ')}
                      </label>
                      <div className="relative">
                        <input
                           type="number"
                           min="0"
                           max="100"
                           value={weights[cat]}
                           onChange={(e) => handleWeightChange(cat, e.target.value)}
                           className="w-full px-3 py-1.5 pr-6 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-lg text-xs text-slate-100 outline-none transition text-center"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 flex items-start space-x-2">
                  <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p>Configure how much relative score weighting is assigned to each category during evaluation. Default profile adds up to 100%.</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-slate-800/80 pt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition shadow-md active:scale-95"
                >
                  Save Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHAT-IF ANALYSIS PREVIEW DRAWER */}
      {showWhatIfModal && whatIfJob && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-end p-0">
          <div className="w-full max-w-3xl h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div className="space-y-0.5">
                <h3 className="text-md font-bold text-slate-100 flex items-center space-x-2">
                  <Scale className="h-5 w-5 text-indigo-400" />
                  <span>What-If Analysis Dashboard</span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Simulate ranking and score fluctuations for: <span className="text-indigo-300 font-semibold">{whatIfJob.Job_Title}</span>
                </p>
              </div>
              <button
                onClick={() => setShowWhatIfModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              
              {/* Interactive Tags Switch */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Interactive Skill Allocation</h4>
                <p className="text-[10px] text-slate-500">
                  Click a skill tag below to toggle its status between <span className="text-indigo-300 font-semibold">Required</span> and <span className="text-slate-300 font-semibold">Preferred</span>:
                </p>
                
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[9px] font-bold text-indigo-400 uppercase self-center w-14">Required:</span>
                    {whatIfRequired.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleSkillRequiredPreferred(s)}
                        className="text-[9px] bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-900 text-indigo-300 px-2 py-0.5 rounded-md font-medium transition active:scale-95"
                      >
                        {s} ⇄
                      </button>
                    ))}
                    {whatIfRequired.length === 0 && <span className="text-[9px] text-slate-600 italic">None</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase self-center w-14">Preferred:</span>
                    {whatIfPreferred.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleSkillRequiredPreferred(s)}
                        className="text-[9px] bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-slate-300 px-2 py-0.5 rounded-md font-medium transition active:scale-95"
                      >
                        {s} ⇄
                      </button>
                    ))}
                    {whatIfPreferred.length === 0 && <span className="text-[9px] text-slate-600 italic">None</span>}
                  </div>
                </div>
              </div>

              {/* Weight sliders */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Weight Simulation Sliders</h4>
                
                <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                  {Object.keys(DEFAULT_WEIGHTS).map((cat) => (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex justify-between items-baseline text-[9px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wider">{cat.replace('_', ' ')}</span>
                        <span className="font-extrabold text-indigo-400">{whatIfWeights[cat]}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={whatIfWeights[cat] || 0}
                        onChange={(e) => handleWhatIfWeightChange(cat, e.target.value)}
                        className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulation triggers */}
              <div className="flex justify-between items-center border-t border-slate-800 pt-4">
                <span className="text-[10px] text-slate-500 italic">
                  Preview runs in memory — no changes are written to the database.
                </span>
                <button
                  type="button"
                  onClick={runWhatIf}
                  disabled={runningWhatIf}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-xs flex items-center space-x-1 shadow-lg disabled:opacity-50"
                >
                  {runningWhatIf ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                      <span>Re-scoring...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      <span>Run Simulation</span>
                    </>
                  )}
                </button>
              </div>

              {/* Simulation results table */}
              {whatIfResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Simulated Rankings Preview</h4>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                          <th className="p-3">Rank</th>
                          <th className="p-3">Candidate</th>
                          <th className="p-3 text-center">Score Delta</th>
                          <th className="p-3 text-right">Rank Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {whatIfResults.map((c) => (
                          <tr key={c.Candidate_ID} className="border-b border-slate-800/40 hover:bg-slate-800/20 last:border-0">
                            <td className="p-3 font-extrabold text-slate-300">#{c.New_Rank}</td>
                            <td className="p-3 font-semibold text-slate-100">{c.Name}</td>
                            <td className="p-3 text-center">
                              <span className="text-slate-400">{c.Old_Score}%</span>
                              <span className="text-indigo-400 font-bold mx-2">➔</span>
                              <span className="text-slate-100 font-extrabold">{c.New_Score}%</span>
                            </td>
                            <td className="p-3 text-right font-semibold">
                              {getRankShiftIcon(c.Old_Rank, c.New_Rank)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Jobs;
