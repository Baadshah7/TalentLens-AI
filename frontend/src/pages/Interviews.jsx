import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, Clock, Video, Phone, MapPin, XCircle, RefreshCw, AlertCircle, Edit, Trash2 } from 'lucide-react';

const Interviews = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reschedule modal states
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState('Online');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduleStatus, setRescheduleStatus] = useState('Scheduled');
  const [saving, setSaving] = useState(false);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/interviews');
      setInterviews(res.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch scheduled interviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleCancelInterview = async (id, interview) => {
    if (!window.confirm('Are you sure you want to cancel this interview session?')) return;
    try {
      await axios.put(`/interviews/${id}`, {
        Interview_DateTime: interview.Interview_DateTime,
        Mode: interview.Mode,
        Notes: interview.Notes,
        Status: 'Cancelled'
      });
      fetchInterviews();
      alert('Interview cancelled successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to cancel interview.');
    }
  };

  const handleDeleteInterview = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this interview entry?')) return;
    try {
      await axios.delete(`/interviews/${id}`);
      fetchInterviews();
      alert('Interview deleted successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete interview.');
    }
  };

  const openRescheduleModal = (itv) => {
    setEditingInterview(itv);
    // Format datetime string for input tag: YYYY-MM-DDTHH:MM
    const dateObj = new Date(itv.Interview_DateTime);
    const tzOffset = dateObj.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
    
    setRescheduleDate(localISOTime);
    setRescheduleMode(itv.Mode);
    setRescheduleNotes(itv.Notes || '');
    setRescheduleStatus(itv.Status);
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleDate) {
      alert('Please choose a valid interview date/time.');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`/interviews/${editingInterview.Interview_ID}`, {
        Interview_DateTime: rescheduleDate,
        Mode: rescheduleMode,
        Notes: rescheduleNotes,
        Status: rescheduleStatus === 'Cancelled' ? 'Rescheduled' : rescheduleStatus
      });
      setShowRescheduleModal(false);
      fetchInterviews();
      alert('Interview details updated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to reschedule interview.');
    } finally {
      setSaving(false);
    }
  };

  const getModeIcon = (mode) => {
    if (mode === 'Online') return <Video className="h-4 w-4 text-sky-400" />;
    if (mode === 'Phone') return <Phone className="h-4 w-4 text-emerald-400" />;
    return <MapPin className="h-4 w-4 text-indigo-400" />;
  };

  const getStatusBadgeStyle = (status) => {
    if (status === 'Scheduled') return 'bg-blue-950/60 border border-blue-900 text-blue-400';
    if (status === 'Rescheduled') return 'bg-amber-950/60 border border-amber-900 text-amber-400';
    if (status === 'Completed') return 'bg-emerald-950/60 border border-emerald-900 text-emerald-400';
    return 'bg-rose-950/60 border border-rose-900 text-rose-400';
  };

  // Live interview states
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveRoomId, setLiveRoomId] = useState(null);
  const [liveMessages, setLiveMessages] = useState([]);
  const [liveInput, setLiveInput] = useState('');
  const wsRef = useRef(null);
  const chatAreaRef = useRef(null);
  const inputRef = useRef(null);

  const joinLive = (roomId) => {
    setLiveMessages([]);
    setLiveRoomId(roomId);
    setLiveOpen(true);
  };

  const [askedQuestions, setAskedQuestions] = useState([]);

  const fetchSmartQuestions = async (jobId, candidateId) => {
    try {
      const res = await axios.post('/chatbot/generate/interviewer', null, { params: { job_id: jobId, candidate_id: candidateId } });
      setAskedQuestions(res.data.questions || []);
    } catch (err) {
      console.error(err);
      alert('Failed to generate smart questions.');
    }
  };

  const leaveLive = () => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    setLiveOpen(false);
    setLiveRoomId(null);
    setLiveMessages([]);
    setLiveInput('');
  };

  useEffect(() => {
    if (!liveOpen || !liveRoomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.hostname}:8000/interviews/ws/${liveRoomId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setLiveMessages(m => [...m, { text: 'Connected to live room.', system: true, time: Date.now() }]);
      // try to focus input shortly after connection
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 120);
    };

    ws.onmessage = (evt) => {
      // message text
      const text = evt.data;
      setLiveMessages(m => [...m, { text, system: false, time: Date.now() }]);
    };

    ws.onclose = () => {
      setLiveMessages(m => [...m, { text: 'Disconnected from live room.', system: true, time: Date.now() }]);
    };

    ws.onerror = (e) => {
      setLiveMessages(m => [...m, { text: 'WebSocket error', system: true, time: Date.now() }]);
    };

    return () => {
      try { ws.close(); } catch (e) {}
      wsRef.current = null;
    };
  }, [liveOpen, liveRoomId]);

  // auto-scroll chat and focus input when messages change
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
    if (liveOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [liveMessages, liveOpen]);

  // allow closing live panel with Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && liveOpen) leaveLive(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [liveOpen]);

  const sendLiveMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Not connected to live session.');
      return;
    }
    const payload = liveInput.trim();
    if (!payload) return;
    wsRef.current.send(payload);
    setLiveMessages(m => [...m, { text: payload, self: true, time: Date.now() }]);
    setLiveInput('');
  };

  // Group into upcoming vs past
  const now = new Date();
  const upcomingInterviews = interviews.filter(i => new Date(i.Interview_DateTime) >= now);
  const pastInterviews = interviews.filter(i => new Date(i.Interview_DateTime) < now);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Interview Schedule</h2>
        <p className="text-sm text-slate-400 mt-1">Manage interview schedules, modes, and notes.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-500 text-xs">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          <span>Updating schedule...</span>
        </div>
      ) : interviews.length === 0 ? (
        <div className="glass-panel text-center py-16 border border-slate-800 rounded-2xl">
          <Calendar className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <h4 className="font-semibold text-slate-300">No scheduled interviews</h4>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Click "Schedule Interview" on a candidate's profile to book a meeting slot.</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Section: Upcoming Meetings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center">
              <span className="h-2 w-2 rounded-full bg-brand-500 mr-2"></span>
              <span>Upcoming Sessions ({upcomingInterviews.length})</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingInterviews.map(itv => (
                <div key={itv.Interview_ID} className="glass-panel border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700/60 transition-all relative overflow-hidden">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100">{itv.Candidate_Name}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{itv.Job_Title}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${getStatusBadgeStyle(itv.Status)}`}>
                        {itv.Status}
                      </span>
                    </div>

                    <div className="space-y-2 mt-4 text-xs text-slate-300">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4.5 w-4.5 text-indigo-400 flex-shrink-0" />
                        <span>{new Date(itv.Interview_DateTime).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getModeIcon(itv.Mode)}
                        <span>{itv.Mode} Interview</span>
                      </div>
                    </div>

                    {itv.Notes && (
                      <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 mt-3 leading-relaxed">
                        <strong>Notes:</strong> {itv.Notes}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 border-t border-slate-900/60 mt-4 pt-3.5">
                    <button
                      onClick={() => openRescheduleModal(itv)}
                      className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      onClick={() => joinLive(itv.Interview_ID)}
                      aria-label={`Join live interview room ${itv.Interview_ID}`}
                      className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center"
                    >
                      <Video className="h-3 w-3 mr-1" />
                      <span>Start / Join Live</span>
                    </button>
                    <button
                      onClick={() => fetchSmartQuestions(itv.Job_ID, itv.Candidate_ID)}
                      className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      <span>Generate Questions</span>
                    </button>
                    {itv.Status !== 'Cancelled' && (
                      <button
                        onClick={() => handleCancelInterview(itv.Interview_ID, itv)}
                        className="px-2.5 py-1.5 border border-rose-950/30 hover:border-rose-900 bg-rose-950/10 hover:bg-rose-950/20 text-rose-400 rounded-lg text-[10px] font-bold transition flex items-center"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        <span>Cancel</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteInterview(itv.Interview_ID)}
                      className="p-1.5 border border-slate-800 hover:border-red-950/30 text-slate-500 hover:text-rose-400 rounded-lg transition"
                      title="Permanently remove schedule log"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {askedQuestions.length > 0 && (
                <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h4 className="font-bold text-slate-100 mb-2">Suggested Interview Questions</h4>
                  <ol className="list-decimal pl-5 text-slate-300">
                    {askedQuestions.map((q, idx) => (
                      <li key={idx} className="mb-2">
                        <div className="text-sm text-slate-100">{q.question}</div>
                        <div className="text-xs text-slate-400">{q.category} — {q.difficulty}</div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {upcomingInterviews.length === 0 && (
                <div className="col-span-2 text-center py-6 text-xs text-slate-500 italic">No upcoming sessions.</div>
              )}
            </div>
          </div>

          {/* Section: Past Meetings */}
          <div className="space-y-4 pt-4 border-t border-slate-900/60">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center">
              <span className="h-2 w-2 rounded-full bg-slate-600 mr-2"></span>
              <span>Past Meetings History ({pastInterviews.length})</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
              {pastInterviews.map(itv => (
                <div key={itv.Interview_ID} className="glass-panel border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700/60 transition-all">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{itv.Candidate_Name}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{itv.Job_Title}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-900 text-[9px] font-bold">
                        Archive
                      </span>
                    </div>

                    <div className="space-y-2 mt-4 text-xs text-slate-400">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4.5 w-4.5 text-slate-500" />
                        <span>{new Date(itv.Interview_DateTime).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getModeIcon(itv.Mode)}
                        <span>{itv.Mode} Interview</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 border-t border-slate-900/60 mt-4 pt-3.5">
                    <button
                      onClick={() => handleDeleteInterview(itv.Interview_ID)}
                      className="p-1.5 border border-slate-800 hover:border-red-950/30 text-slate-500 hover:text-rose-400 rounded-lg transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {pastInterviews.length === 0 && (
                <div className="col-span-2 text-center py-6 text-xs text-slate-500 italic">No past sessions history.</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Reschedule/Edit Details Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-md font-bold text-slate-100 flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <span>Update Interview Settings</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Adjust scheduling times, location/meeting modes, and interviewer notes for <strong className="text-indigo-300">{editingInterview.Candidate_Name}</strong>.
              </p>
            </div>
            
            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs text-slate-200">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl outline-none text-slate-100"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Meeting Mode</label>
                  <select
                    value={rescheduleMode}
                    onChange={(e) => setRescheduleMode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl outline-none text-slate-100"
                  >
                    <option value="Online">Online Video Meeting</option>
                    <option value="In-Person">In-Person Office Meeting</option>
                    <option value="Phone">Phone Call Interview</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Interview Status</label>
                  <select
                    value={rescheduleStatus}
                    onChange={(e) => setRescheduleStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl outline-none text-slate-100"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Recruiting Notes</label>
                  <textarea
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    placeholder="Provide details or online join links..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl outline-none text-slate-100 min-h-[60px]"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-300 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {saving ? 'Updating...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Interview Panel */}
      {liveOpen && (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-100">Live Interview — Room {liveRoomId}</h4>
              <div className="flex items-center space-x-2">
                <button onClick={leaveLive} aria-label="Close live interview panel" className="px-2 py-1 text-xs rounded bg-rose-700/20 text-rose-300">Close</button>
              </div>
            </div>

            <div ref={chatAreaRef} className="h-64 overflow-auto bg-slate-950/20 p-3 rounded-md border border-slate-800 mb-3">
              {liveMessages.map((m, idx) => (
                <div key={idx} className={`mb-2 ${m.system ? 'text-slate-400 text-xs italic' : (m.self ? 'text-right' : 'text-left')}`}>
                  <div className="inline-block max-w-[80%] px-3 py-1.5 rounded-md bg-slate-800 text-slate-200 text-[13px]">
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex space-x-2">
              <input
                ref={inputRef}
                aria-label="Live chat message"
                value={liveInput}
                onChange={(e) => setLiveInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendLiveMessage(); }}
                placeholder="Type a message or paste notes..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl outline-none text-slate-100"
              />
              <button aria-label="Send live message" onClick={sendLiveMessage} className="px-3 py-2 bg-indigo-600 rounded-xl text-white">Send</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Interviews;
