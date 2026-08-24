import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, KeyRound, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

const CandidateLogin = () => {
  const { candidateLoginRequest, candidateLoginVerify } = useAuth();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState(1); // 1 = Email, 2 = OTP
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    setMessage('');
    
    const res = await candidateLoginRequest(email);
    setLoading(false);
    if (res.success) {
      setStep(2);
      setMessage(res.message || 'OTP verification code sent to your email.');
    } else {
      setError(res.message);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    
    const res = await candidateLoginVerify(email, otpCode);
    setLoading(false);
    if (res.success) {
      navigate('/assessments');
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-indigo-650/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-violet-650/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-350">
        
        {/* Logo and Brand */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-brand-600 items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-950/40 glow-accent-violet">
            TL
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">TalentLens Candidate Portal</h2>
          <p className="text-xs text-slate-400">Authenticate to start your dynamic skills assessment</p>
        </div>

        {/* Login Panel */}
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl bg-slate-900/40 backdrop-blur-md">
          
          {error && (
            <div className="mb-5 flex items-start space-x-2.5 p-3 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-300 text-xs">
              <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-5 flex items-start space-x-2.5 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs">
              <ShieldCheck className="h-4.5 w-4.5 flex-shrink-0 mt-0.5 text-emerald-400" />
              <span className="font-semibold leading-relaxed">{message}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Candidate Email Address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="e.g. candidate@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-200 placeholder-slate-650 outline-none text-xs transition shadow-inner font-medium"
                    disabled={loading}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Use the exact email address submitted in your resume application.</p>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs shadow-md transition active:scale-98 flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying details...</span>
                  </>
                ) : (
                  <>
                    <span>Request Access Code</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">6-Digit Verification Code</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-500">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="Enter 6-digit OTP code"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-slate-100 placeholder-slate-650 outline-none text-sm tracking-widest text-center font-bold outline-none transition shadow-inner"
                    disabled={loading}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                  <span>Code is valid for 10 minutes</span>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setOtpCode(''); setError(''); }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline"
                  >
                    Change Email
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-550 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-md transition active:scale-98 flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying OTP code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Enter Portal</span>
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};

export default CandidateLogin;
