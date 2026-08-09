import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Briefcase, MapPin, Building, Calendar, Plus, Edit2, Trash2, X, Info, Sparkles } from 'lucide-react';

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
    
    // Map list of weights from DB (array of {Category, Weight}) to our dict
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
      Weights: weights
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

      {/* Modal Form Dialog */}
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
                  rows="4"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize the core roles, requirements, and day-to-day operations..."
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none"
                />
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
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Preferred Skills (CSV)</label>
                    <textarea
                      rows="2"
                      value={prefSkills}
                      onChange={(e) => setPrefSkills(e.target.value)}
                      placeholder="FastAPI, Docker, AWS"
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Certifications (CSV)</label>
                    <textarea
                      rows="2"
                      value={certifications}
                      onChange={(e) => setCertifications(e.target.value)}
                      placeholder="AWS Solution Architect, PMP"
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition resize-none"
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
    </div>
  );
};

export default Jobs;
