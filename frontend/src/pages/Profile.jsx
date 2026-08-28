import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  User, Phone, MapPin, UploadCloud, RefreshCw, Briefcase, FileText, 
  CheckCircle, Clock, AlertCircle, Edit3, X, Award, ShieldCheck, 
  GraduationCap, Sparkles, FolderGit2, Calendar, ChevronRight, ExternalLink
} from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  
  // State
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Editable fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('/candidates/profile/data');
      setProfile(res.data);
      setName(res.data.Name || '');
      setPhone(res.data.Phone || '');
      setLocation(res.data.Location || '');
    } catch (err) {
      console.error(err);
      setError('Could not retrieve candidate profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await axios.put('/candidates/profile/data', { Name: name, Phone: phone, Location: location });
      setSuccessMsg('Profile details updated successfully!');
      
      // Update local storage user name
      const stored = JSON.parse(sessionStorage.getItem('user'));
      if (stored) {
        stored.Name = name;
        sessionStorage.setItem('user', JSON.stringify(stored));
      }
      
      setIsEditModalOpen(false);
      fetchProfileData();
    } catch (err) {
      setError('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError('');
    setSuccessMsg('');
    try {
      await axios.post('/candidates/profile/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessMsg('Resume uploaded successfully! Parsing extracted skills...');
      
      // Poll profile data to check parsed details
      setTimeout(() => {
        fetchProfileData();
      }, 2500);
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Resume upload failed.';
      setError(errMsg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24 text-slate-500 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-xs font-bold text-slate-400">Loading Candidate Executive Profile...</p>
      </div>
    );
  }

  const primaryRole = profile?.Experiences?.[0]?.Role || 'Software Professional';
  const parsedStatus = profile?.Processing_Status || 'Pending';

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto pb-16">
      
      {/* Toast Notifications */}
      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800/40 text-red-300 rounded-2xl text-xs flex items-center justify-between shadow-xl">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4.5 w-4.5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 rounded-2xl text-xs flex items-center justify-between shadow-xl">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXECUTIVE CANDIDATE HEADER BANNER */}
      {/* ========================================================================= */}
      <div className="p-8 rounded-3xl bg-slate-900/80 border border-indigo-500/20 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-b from-indigo-600/10 via-cyan-500/10 to-transparent rounded-full blur-[100px] pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          
          <div className="flex items-start md:items-center space-x-5">
            {/* Avatar Badge */}
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 p-0.5 shrink-0 shadow-lg shadow-indigo-950/50 relative">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-300 font-black text-2xl tracking-wider">
                {profile?.Name ? profile.Name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'CD'}
              </div>
              <span className="absolute -bottom-1 -right-1 h-4.5 w-4.5 bg-emerald-500 border-2 border-slate-950 rounded-full" title="Active Account"></span>
            </div>

            {/* Candidate Identity */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-black text-white tracking-tight">{profile?.Name || 'Candidate Name'}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-bold text-indigo-300 flex items-center space-x-1">
                  <ShieldCheck className="h-3 w-3 text-cyan-400" />
                  <span>Verified Profile</span>
                </span>
              </div>
              
              <p className="text-xs font-semibold text-slate-400 flex items-center space-x-2">
                <span className="text-cyan-400 font-bold">{primaryRole}</span>
                <span>•</span>
                <span>{profile?.Email}</span>
              </p>

              {/* Meta details */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 font-medium">
                {profile?.Phone && (
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <Phone className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{profile.Phone}</span>
                  </span>
                )}
                {profile?.Location && (
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{profile.Location}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 self-start md:self-center">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
              <span>Edit Details</span>
            </button>

            <label className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-950/50 flex items-center space-x-2 cursor-pointer">
              {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
              <span>{uploading ? 'Parsing Resume...' : 'Update Resume'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={handleResumeUpload}
                disabled={uploading}
              />
            </label>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* KEY METRICS SUMMARY ROW */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center backdrop-blur-md">
          <div className="text-2xl font-black text-indigo-400">{profile?.Applications?.length || 0}</div>
          <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Active Job Applications</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center backdrop-blur-md">
          <div className="text-2xl font-black text-cyan-400">{profile?.Skills?.length || 0}</div>
          <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Extracted Skills</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center backdrop-blur-md">
          <div className="text-2xl font-black text-emerald-400">{profile?.Experiences?.length || 0}</div>
          <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Work History Records</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center backdrop-blur-md">
          <div className="text-xs font-black uppercase tracking-wider text-slate-200 mt-1">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              parsedStatus === 'Parsed'
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                : parsedStatus === 'Pending' || parsedStatus === 'Processing'
                  ? 'bg-indigo-950/40 border-indigo-800/40 text-indigo-400 animate-pulse'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              {parsedStatus}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-semibold mt-2">Resume Parse Status</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN DASHBOARD CONTENT GRID */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Resume Badge + Skills Taxonomy + Education */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Card 1: Resume File Badge */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                <span>Resume Document</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PDF / DOCX</span>
            </div>

            {profile?.Resume_Name ? (
              <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl space-y-3">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-200 truncate">{profile.Resume_Name}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Verified Document • Extracted</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 border-t border-slate-900">
                  <span>Status: <strong className="text-emerald-400 font-bold">{parsedStatus}</strong></span>
                  <label className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">
                    Replace
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleResumeUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-850 rounded-xl bg-slate-950/40 p-4">
                <UploadCloud className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">No Resume File Uploaded</p>
                <p className="text-[10px] text-slate-500 mt-1">Upload your PDF or DOCX resume to auto-populate skills and experience.</p>
              </div>
            )}
          </div>

          {/* Card 2: Extracted Technical Skills Taxonomy */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-2">
                <Award className="h-4 w-4 text-cyan-400" />
                <span>Extracted Skills</span>
              </h3>
              <span className="text-[10px] font-bold text-cyan-400">{profile?.Skills?.length || 0} Total</span>
            </div>

            {!profile?.Skills || profile.Skills.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">Upload a resume to automatically extract verified skills.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {profile.Skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 flex items-center space-x-1.5 hover:border-indigo-500/40 transition"
                  >
                    <span>{s.Skill}</span>
                    {s.Skill_Level && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                        {s.Skill_Level}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Education & Certifications */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-2">
                <GraduationCap className="h-4 w-4 text-indigo-400" />
                <span>Education & Credentials</span>
              </h3>
            </div>

            {/* Educations */}
            {!profile?.Educations || profile.Educations.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">No education entries recorded.</p>
            ) : (
              <div className="space-y-3">
                {profile.Educations.map((ed, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1">
                    <div className="text-xs font-bold text-slate-200">{ed.Degree}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{ed.Institution}</div>
                    {ed.Graduation_Year && <div className="text-[10px] text-slate-500">Graduated: {ed.Graduation_Year}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Certifications */}
            {profile?.Certifications && profile.Certifications.length > 0 && (
              <div className="pt-3 border-t border-slate-850 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Certifications</div>
                <div className="space-y-2">
                  {profile.Certifications.map((c, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-850">
                      <ShieldCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <div>
                        <span className="font-bold">{c.Certification_Name}</span>
                        {c.Issuing_Org && <span className="text-slate-500 text-[10px]"> — {c.Issuing_Org}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Work History Timeline + Projects + Applications */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Work Experience Timeline */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 space-y-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-2">
                <Briefcase className="h-4 w-4 text-indigo-400" />
                <span>Work Experience Timeline</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">{profile?.Experiences?.length || 0} Positions Recorded</span>
            </div>

            {!profile?.Experiences || profile.Experiences.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Briefcase className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">No experience records found.</p>
                <p className="text-[10px] text-slate-500 mt-1">Upload a resume file to automatically populate work history timeline.</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-850">
                {profile.Experiences.map((exp, idx) => (
                  <div key={idx} className="relative pl-8 space-y-2 group">
                    {/* Timeline dot */}
                    <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-slate-950 group-hover:bg-cyan-400 transition-colors"></div>
                    
                    <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-2 hover:border-indigo-500/30 transition">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h4 className="font-extrabold text-sm text-slate-100">{exp.Role}</h4>
                        {exp.Duration_Months && (
                          <span className="text-[10px] font-bold text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 self-start sm:self-auto">
                            {exp.Duration_Months} Months Experience
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-cyan-400">{exp.Company}</div>
                      
                      {exp.Description && (
                        <p className="text-xs text-slate-400 leading-relaxed font-normal pt-1">
                          {exp.Description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Projects Portfolio */}
          {profile?.Projects && profile.Projects.length > 0 && (
            <div className="glass-panel border border-slate-850 rounded-2xl p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-2">
                  <FolderGit2 className="h-4 w-4 text-cyan-400" />
                  <span>Projects & Applied Portfolio</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.Projects.map((p, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-2">
                    <h4 className="font-bold text-xs text-slate-100">{p.Project_Name}</h4>
                    {p.Technologies && (
                      <div className="text-[10px] text-cyan-400 font-semibold">{p.Technologies}</div>
                    )}
                    {p.Description && (
                      <p className="text-[11px] text-slate-400 leading-relaxed font-normal">{p.Description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Job Applications Tracker */}
          <div className="glass-panel border border-slate-850 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <span>Active Job Applications</span>
              </h3>
              <span className="text-[10px] font-bold text-indigo-400">{profile?.Applications?.length || 0} Submissions</span>
            </div>

            {!profile?.Applications || profile.Applications.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Briefcase className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">No active applications.</p>
                <p className="text-[10px] text-slate-500 mt-1">When recruiters process your profile for positions, applications will track here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 font-bold">
                      <th className="py-2.5">Position</th>
                      <th className="py-2.5">Department</th>
                      <th className="py-2.5">Applied Date</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.Applications.map((app) => {
                      const isInterview = app.Status === 'Interview Scheduled';
                      const isShortlisted = app.Status === 'Shortlisted';
                      const isRejected = app.Status === 'Rejected';
                      
                      return (
                        <tr key={app.Candidate_ID} className="border-b border-slate-850 last:border-0 hover:bg-slate-900/40 transition">
                          <td className="py-3.5 font-bold text-slate-200">{app.Job_Title}</td>
                          <td className="py-3.5 text-slate-400">{app.Department}</td>
                          <td className="py-3.5 text-slate-500 font-medium">
                            {app.Application_Date ? new Date(app.Application_Date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3.5 text-right">
                            <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              isShortlisted
                                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                                : isInterview
                                  ? 'bg-indigo-950/40 border-indigo-800/40 text-indigo-300 shadow-md'
                                  : isRejected
                                    ? 'bg-red-950/40 border-red-800/40 text-red-400'
                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}>
                              {isInterview && <Clock className="h-3 w-3 text-indigo-400" />}
                              <span>{app.Status}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* EDIT PROFILE DETAILS MODAL */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-6 right-6 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <User className="h-5 w-5 text-indigo-400" />
                <span>Edit Personal Details</span>
              </h3>
              <p className="text-xs text-slate-400">Update your primary contact information displayed to recruiters.</p>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 555-0199"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. New York, NY"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 outline-none transition font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
