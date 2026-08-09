import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, User, Mail, Phone, MapPin, Briefcase, FileText, CheckCircle2, XCircle, Award, ShieldAlert, Sparkles, RefreshCw, Layers, Scale, Eye } from 'lucide-react';

const CandidateDetail = () => {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealReason, setRevealReason] = useState('');
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [error, setError] = useState('');

  const fetchCandidateData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/candidates/${id}/detail`);
      setCandidate(res.data);
      
      const jobRes = await axios.get(`/jobs/${res.data.Job_ID}`);
      setJob(jobRes.data);
      
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to retrieve candidate profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidateData();
  }, [id]);

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await axios.post(`/candidates/${id}/rescore`);
      await fetchCandidateData();
      alert('Candidate scoring weights re-evaluated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to re-score candidate.');
    } finally {
      setRescoring(false);
    }
  };

  const handleReveal = async (e) => {
    e.preventDefault();
    if (!revealReason.trim()) {
      alert("Please provide a valid reason for identity disclosure.");
      return;
    }

    setRevealing(true);
    try {
      const res = await axios.post(`/candidates/${id}/reveal`, { Reason: revealReason });
      setCandidate(res.data);
      setShowRevealModal(false);
      setRevealReason('');
      alert('Candidate identity disclosed successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to reveal candidate identity.');
    } finally {
      setRevealing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 text-slate-400 text-sm">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading applicant profile...</span>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/upload" className="inline-flex items-center space-x-2 text-sm text-brand-400 hover:text-brand-300">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to uploads</span>
        </Link>
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-300 text-sm flex items-center space-x-2">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <span>{error || 'Applicant profile not found.'}</span>
        </div>
      </div>
    );
  }

  const scoreInfo = candidate.screening_results?.[0] || {
    Skill_Score: 0,
    Experience_Score: 0,
    Education_Score: 0,
    Project_Score: 0,
    Certification_Score: 0,
    Completeness_Score: 0,
    Semantic_Score: 0,
    Overall_Score: 0,
    Explanation: { strengths: [], gaps: [], recommendation: 'Low Match', missing_skills: [] },
    Confidence_Level: 'Low'
  };

  const explanation = scoreInfo.Explanation || { strengths: [], gaps: [], recommendation: 'Low Match', missing_skills: [] };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-950/40 border-emerald-900';
    if (score >= 50) return 'text-amber-400 bg-amber-950/40 border-amber-900';
    return 'text-red-400 bg-red-950/40 border-red-900';
  };

  const getProgressColor = (score) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const subscores = [
    { label: 'Skills Alignment', value: scoreInfo.Skill_Score, desc: 'Exact & taxonomy matches vs required/preferred skills' },
    { label: 'Experience Match', value: scoreInfo.Experience_Score, desc: 'Duration of experience set as semantically relevant' },
    { label: 'Education Match', value: scoreInfo.Education_Score, desc: 'Grade hierarchy check against required education level' },
    { label: 'Project Relevance', value: scoreInfo.Project_Score, desc: 'Cosine similarity of candidate project logs vs job parameters' },
    { label: 'Certifications Match', value: scoreInfo.Certification_Score, desc: 'Exact matches vs required certifications' },
    { label: 'Profile Completeness', value: scoreInfo.Completeness_Score, desc: 'Percentage of contact info, education, and career blocks populated' },
    { label: 'Semantic Fit (NLP)', value: scoreInfo.Semantic_Score, desc: 'Direct document similarity metric via sentence-transformers' }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Navigation & Actions */}
      <div className="flex justify-between items-center">
        <Link to={`/upload?jobId=${candidate.Job_ID}`} className="inline-flex items-center space-x-2 text-sm text-brand-400 hover:text-brand-300">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Applicants</span>
        </Link>

        <div className="flex items-center space-x-3">
          {/* Persistent Ethical Screen active indicator */}
          <div className="flex items-center space-x-2 text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/60 px-3 py-1.5 rounded-xl font-bold">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Ethical Screening Verified Active</span>
          </div>

          {/* Reveal Identity Action */}
          {job?.Blind_Mode && !candidate.Is_Identity_Revealed && (
            <button
              onClick={() => setShowRevealModal(true)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700 hover:border-indigo-600 text-indigo-200 rounded-xl text-xs font-semibold transition"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              <span>Reveal Identity</span>
            </button>
          )}

          <button
            onClick={handleRescore}
            disabled={rescoring || candidate.Processing_Status === 'Failed'}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold transition disabled:opacity-50"
          >
            {rescoring ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                <span>Calculating...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-indigo-400 mr-1" />
                <span>Re-score Candidate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Candidate Info & Subscores */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card: Base Metadata */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 to-indigo-500"></div>
            
            <div className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-brand-400 text-2xl font-bold mb-4 shadow-inner">
              {candidate.Name.substring(0, 2).toUpperCase()}
            </div>
            
            <h3 className="text-xl font-bold text-slate-100">{candidate.Name}</h3>
            {job?.Blind_Mode && !candidate.Is_Identity_Revealed ? (
              <span className="text-[9px] text-indigo-400 bg-indigo-950/40 border border-indigo-900 px-2 py-0.5 rounded-full font-bold inline-block mt-1 uppercase">Anonymized Candidate</span>
            ) : (
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1 block">Applicant Profile</span>
            )}
            
            <div className="mt-6 space-y-3.5 text-left border-t border-slate-900/60 pt-5 text-xs text-slate-400">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                <span className="truncate" title={candidate.Email}>{candidate.Email || 'Not Extracted'}</span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                <span>{candidate.Phone || 'Not Extracted'}</span>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                <span>{candidate.Location || 'Not Extracted'}</span>
              </div>
              <div className="flex items-center space-x-3">
                <Briefcase className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                <span className="truncate" title={job?.Job_Title}>Applying for: {job?.Job_Title || 'Loading...'}</span>
              </div>
            </div>
          </div>

          {/* Card: Explainable AI Result Summary */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Evaluation</h4>
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                scoreInfo.Confidence_Level === 'High' 
                  ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400' 
                  : scoreInfo.Confidence_Level === 'Medium' 
                    ? 'bg-amber-950/40 border-amber-900/50 text-amber-400' 
                    : 'bg-rose-950/40 border-rose-900/50 text-rose-400'
              }`}>
                {scoreInfo.Confidence_Level} AI Confidence
              </span>
            </div>
            
            <div className="text-center my-4">
              <div className={`inline-flex px-4 py-2 border rounded-2xl text-4xl font-extrabold ${getScoreColor(scoreInfo.Overall_Score)}`}>
                {scoreInfo.Overall_Score}%
              </div>
              <p className="text-[11px] font-bold text-slate-300 mt-3">{explanation.recommendation}</p>
            </div>

            <div className="border-t border-slate-800/60 pt-4 space-y-3.5 text-xs">
              <div>
                <h5 className="font-bold text-slate-300 mb-1.5 flex items-center space-x-1 text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Strengths</span>
                </h5>
                {explanation.strengths.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No significant strengths detected.</p>
                ) : (
                  <ul className="list-disc pl-4 text-slate-400 space-y-1 text-[10px] leading-relaxed">
                    {explanation.strengths.map((str, idx) => (
                      <li key={idx}>{str}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h5 className="font-bold text-slate-300 mb-1.5 flex items-center space-x-1 text-[11px]">
                  <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  <span>Key Gaps</span>
                </h5>
                {explanation.gaps.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No significant gaps detected.</p>
                ) : (
                  <ul className="list-disc pl-4 text-rose-300/80 space-y-1 text-[10px] leading-relaxed">
                    {explanation.gaps.map((gap, idx) => (
                      <li key={idx}>{gap}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Details Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Skill Gap Analysis */}
          {explanation.missing_skills && explanation.missing_skills.length > 0 && (
            <div className="p-4 bg-indigo-950/20 border border-indigo-900/60 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Scale className="h-4 w-4" />
                <span>Skill Gap Analysis</span>
              </h4>
              <p className="text-[10px] text-slate-400">
                The candidate is missing the following required skills specified in the job parameters:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {explanation.missing_skills.map((skill, idx) => (
                  <span key={idx} className="text-[9px] bg-rose-950/40 border border-rose-900/60 text-rose-400 px-2 py-0.5 rounded-md font-semibold">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Card: Detailed Sub-Scores progress */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Sub-Score Breakdown</h4>
            
            <div className="space-y-4">
              {subscores.map((sub, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-semibold text-slate-200">{sub.label}</span>
                    <span className="font-bold text-slate-400">{sub.value}%</span>
                  </div>
                  <div className="w-full bg-slate-900 border border-slate-900 rounded-full h-2">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(sub.value)}`}
                      style={{ width: `${sub.value}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">{sub.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Extracted Details Profile */}
          <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 space-y-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-3 mb-2">Extracted Candidate Profile</h4>

            {/* Experiences */}
            <div className="space-y-4">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center space-x-1.5">
                <Briefcase className="h-4 w-4 text-brand-400" />
                <span>Professional Experience</span>
              </h5>
              
              {candidate.experiences.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No professional experience extracted.</p>
              ) : (
                <div className="space-y-4 border-l border-slate-800 pl-4 ml-2">
                  {candidate.experiences.map((exp, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <h6 className="text-xs font-bold text-slate-200">{exp.Role || 'Role Unknown'}</h6>
                          <p className="text-[11px] text-slate-400 font-medium">{exp.Company || 'Company Unknown'}</p>
                        </div>
                        <div className="flex items-center space-x-2 text-right">
                          <span className="text-[10px] text-slate-500 font-semibold">{exp.Duration_Months} months</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                            exp.Is_Relevant 
                              ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' 
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}>
                            {exp.Is_Relevant ? 'Semantically Relevant' : 'Not Relevant'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 whitespace-pre-line leading-relaxed">{exp.Description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-brand-400" />
                <span>Extracted Skills & Keyword Evidence</span>
              </h5>
              
              {candidate.skills.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No technical skills parsed.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {candidate.skills.map((sk, idx) => (
                    <div key={idx} className="bg-slate-900/50 border border-slate-900 p-2.5 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-200">{sk.Skill}</span>
                        <span className="text-[9px] bg-slate-900 text-indigo-400 border border-slate-800 px-1.5 py-0.5 rounded-md uppercase font-bold">
                          {sk.Skill_Level}
                        </span>
                      </div>
                      {sk.Evidence_Text && (
                        <p className="text-[10px] text-slate-500 italic leading-relaxed" title={sk.Evidence_Text}>
                          Evidence: "{sk.Evidence_Text}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Education */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-brand-400" />
                <span>Education History</span>
              </h5>
              
              {candidate.educations.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No education entries extracted.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {candidate.educations.map((edu, idx) => (
                    <div key={idx} className="bg-slate-900/50 border border-slate-900 p-3 rounded-xl flex justify-between items-start">
                      <div>
                        <h6 className="text-xs font-bold text-slate-200">{edu.Degree || 'Degree Level'}</h6>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{edu.Institution || 'Institution'}</p>
                      </div>
                      {edu.Graduation_Year && (
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800">
                          Class of {edu.Graduation_Year}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Projects */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-brand-400" />
                <span>Academic & Personal Projects</span>
              </h5>
              
              {candidate.projects.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No project blocks parsed.</p>
              ) : (
                <div className="space-y-3">
                  {candidate.projects.map((proj, idx) => (
                    <div key={idx} className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl space-y-2">
                      <h6 className="text-xs font-bold text-slate-200">{proj.Project_Name}</h6>
                      {proj.Description && (
                        <p className="text-xs text-slate-400 leading-relaxed">{proj.Description}</p>
                      )}
                      {proj.Technologies && proj.Technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {proj.Technologies.map((t, i) => (
                            <span key={i} className="text-[9px] bg-slate-900 border border-slate-800 text-indigo-300 px-2 py-0.5 rounded-md font-medium">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certifications */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center space-x-1.5">
                <Award className="h-4 w-4 text-brand-400" />
                <span>Certifications</span>
              </h5>
              
              {candidate.certifications.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No certifications extracted.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {candidate.certifications.map((cert, idx) => (
                    <div key={idx} className="bg-slate-900/50 border border-slate-900 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-200">{cert.Certification_Name}</span>
                      <span className="text-[10px] text-slate-500 font-bold bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                        {cert.Issuing_Org}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Identity Disclosure Reveal Reason Modal */}
      {showRevealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-md font-bold text-slate-100 flex items-center space-x-2">
                <Eye className="h-5 w-5 text-indigo-400" />
                <span>Disclose Candidate Identity</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                You are about to reveal this candidate's real name and contact details. This action will be logged in the permanent compliance audit trail.
              </p>
            </div>
            
            <form onSubmit={handleReveal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Justification Reason</label>
                <textarea
                  value={revealReason}
                  onChange={(e) => setRevealReason(e.target.value)}
                  placeholder="e.g. Applicant matches required skill scores; disclosing details to invite for technical interview."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 outline-none transition text-xs min-h-[80px]"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowRevealModal(false); setRevealReason(''); }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-300 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revealing}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {revealing ? 'Disclosing...' : 'Confirm Reveal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CandidateDetail;
