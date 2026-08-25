import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, Phone, MapPin, UploadCloud, RefreshCw, Briefcase, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  
  // State
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
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
      setSuccessMsg('Resume uploaded successfully! Parsing parsing in progress.');
      
      // Poll profile data to check parsed details
      setTimeout(() => {
        fetchProfileData();
      }, 3000);
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Resume upload failed.';
      setError(errMsg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 text-slate-500">
        <RefreshCw className="h-7 w-7 animate-spin mb-3 text-slate-650" />
        <p className="text-xs font-bold">Synchronizing profile details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl mx-auto pb-12">
      
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-black text-white tracking-tight">Candidate Profile & Applications</h2>
        <p className="text-xs text-slate-550 mt-1 leading-relaxed">Manage your contact credentials, upload parsed resumes, and track active recruiter decisions.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-955 border border-red-900/30 text-red-300 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="h-4.5 w-4.5 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-955 border border-emerald-900/30 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-450 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: Contact & Resume Upload */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Card: Contact Info */}
          <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-205 border-b border-slate-900 pb-2">Personal Details</h3>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-650" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-xs text-slate-100 placeholder-slate-600 outline-none transition font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-650" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 555-0199"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-xs text-slate-100 placeholder-slate-600 outline-none transition font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-650" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. New York, NY"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-850 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-xs text-slate-100 placeholder-slate-600 outline-none transition font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {saving ? 'Saving...' : 'Save Profile Details'}
              </button>
            </form>
          </div>

          {/* Card: Resume upload */}
          <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-205 border-b border-slate-900 pb-2 font-bold">Resume Profile</h3>
            
            {profile?.Resume_Name ? (
              <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <FileText className="h-4.5 w-4.5 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300 truncate font-semibold">{profile.Resume_Name}</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 flex-shrink-0">
                  {profile.Processing_Status || 'Parsed'}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 font-medium">No resume uploaded yet. Upload a resume to automatically extract skills and work history.</p>
            )}

            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-850 hover:border-indigo-500/50 bg-slate-950/40 rounded-xl p-6 cursor-pointer hover:bg-slate-900/10 transition group">
                {uploading ? (
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-400 mb-2" />
                ) : (
                  <UploadCloud className="h-8 w-8 text-slate-500 group-hover:text-indigo-400 transition mb-2" />
                )}
                <span className="text-[11px] font-bold text-slate-350">{uploading ? 'Processing resume file...' : 'Upload PDF/Docx Resume'}</span>
                <span className="text-[9px] text-slate-505 font-medium mt-1">Maximum size 10MB</span>
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

        {/* RIGHT: Parsed Details & Applications */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Applications Dashboard */}
          <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-205 border-b border-slate-900 pb-2">Active Job Applications</h3>
            
            {!profile?.Applications || profile.Applications.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Briefcase className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">No applications found.</p>
                <p className="text-[10px] text-slate-555 mt-0.5">Apply to jobs through recruiter screenings to view listings here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-500 font-bold">
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
                        <tr key={app.Candidate_ID} className="border-b border-slate-900 last:border-0 hover:bg-slate-900/10">
                          <td className="py-3 font-semibold text-slate-200">{app.Job_Title}</td>
                          <td className="py-3 text-slate-450">{app.Department}</td>
                          <td className="py-3 text-slate-500 font-medium">
                            {app.Application_Date ? new Date(app.Application_Date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3 text-right">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              isShortlisted
                                ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-450'
                                : isInterview
                                  ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-450 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                                  : isRejected
                                    ? 'bg-red-955 border-red-900/30 text-red-400'
                                    : 'bg-slate-950 border-slate-900 text-slate-455'
                            }`}>
                              {isInterview && <Clock className="h-2.5 w-2.5 text-indigo-400" />}
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

          {/* Parsed Resume Details Card */}
          <div className="glass-panel border border-slate-900 rounded-2xl p-5 space-y-6">
            <h3 className="font-extrabold text-sm text-slate-205 border-b border-slate-900 pb-2">Skills & Professional Profile</h3>
            
            {/* Skills tags */}
            <div className="space-y-2">
              <h4 className="text-[10px] text-slate-550 uppercase tracking-widest font-black">Skills Extracted</h4>
              {!profile?.Skills || profile.Skills.length === 0 ? (
                <p className="text-xs text-slate-550 font-medium italic">Upload a resume to extract skill tags.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.Skills.map((s, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-lg text-[10px] font-bold text-slate-300">
                      {s.Skill} <span className="text-[9px] text-slate-500 font-medium">({s.Skill_Level})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Experiences list */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] text-slate-550 uppercase tracking-widest font-black">Experience History</h4>
              {!profile?.Experiences || profile.Experiences.length === 0 ? (
                <p className="text-xs text-slate-555 font-medium italic">No experience record extracted.</p>
              ) : (
                <div className="space-y-4">
                  {profile.Experiences.map((exp, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-1">
                      <div className="flex justify-between items-start">
                        <h5 className="text-xs font-bold text-slate-200">{exp.Role}</h5>
                        <span className="text-[9px] text-slate-500 font-bold">{exp.Duration_Months} mos</span>
                      </div>
                      <p className="text-[10px] text-indigo-400 font-bold">{exp.Company}</p>
                      {exp.Description && <p className="text-[10px] text-slate-500 leading-relaxed font-medium pt-1">{exp.Description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Education list */}
            <div className="space-y-3">
              <h4 className="text-[10px] text-slate-550 uppercase tracking-widest font-black">Education</h4>
              {!profile?.Educations || profile.Educations.length === 0 ? (
                <p className="text-xs text-slate-555 font-medium italic">No education records extracted.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.Educations.map((edu, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-909 rounded-xl flex flex-col justify-between">
                      <span className="text-[10px] text-slate-200 font-bold leading-snug">{edu.Degree}</span>
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold mt-2">
                        <span className="truncate pr-1">{edu.Institution}</span>
                        <span>{edu.Graduation_Year}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Profile;
