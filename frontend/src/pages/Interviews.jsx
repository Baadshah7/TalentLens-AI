import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, Video, Phone, MapPin, XCircle, RefreshCw, AlertCircle, Edit, Trash2, Mic, MicOff, Camera, CameraOff, ScreenShare, Sparkles, User, ShieldAlert, CheckCircle, ChevronRight, X, Info, Award, MessageSquare } from 'lucide-react';

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
  const { user } = useAuth();
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveRoomId, setLiveRoomId] = useState(null);
  const [liveInterview, setLiveInterview] = useState(null);
  const [liveMessages, setLiveMessages] = useState([]);
  const [liveInput, setLiveInput] = useState('');
  
  // Structured notes states
  const [structuredNotes, setStructuredNotes] = useState([]);
  const [selectedTag, setSelectedTag] = useState('Technical');
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  // WebRTC connection states
  const [connState, setConnState] = useState('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const wsRef = useRef(null);
  const chatAreaRef = useRef(null);
  const inputRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const clientId = useRef(Math.random().toString(36).substring(7)).current;

  const joinLive = async (interview) => {
    setLiveInterview(interview);
    setLiveRoomId(interview.Interview_ID);
    setLiveMessages([]);
    setLiveInput('');
    setCallDuration(0);
    setConnState('Connecting');
    setIsMuted(false);
    setIsCameraOff(false);
    setLocalStream(null);
    setRemoteStream(null);
    setShowSummary(false);
    
    // Parse notes
    let parsedNotes = [];
    try {
      if (interview.Notes) {
        parsedNotes = JSON.parse(interview.Notes);
        if (!Array.isArray(parsedNotes)) parsedNotes = [];
      }
    } catch (e) {
      if (interview.Notes) {
        parsedNotes = [{
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tag: 'General',
          text: interview.Notes
        }];
      }
    }
    setStructuredNotes(parsedNotes);
    
    // Fetch candidate details for quick-reference sidebar
    if (user?.Role !== 'Candidate') {
      try {
        const res = await axios.get(`/candidates/${interview.Candidate_ID}/detail`);
        setCandidateDetail(res.data);
      } catch (err) {
        console.error("Failed to fetch candidate details for sidebar", err);
      }
    }
    
    setLiveOpen(true);
  };

  const [askedQuestions, setAskedQuestions] = useState([]);

  const fetchSmartQuestions = async (jobId, candidateId) => {
    try {
      const res = await axios.post('/chatbot/generate/interviewer', null, { params: { job_id: jobId, candidate_id: candidateId } });
      setAskedQuestions(res.data.questions || []);
    } catch (err) {
      console.error(err);
      alert('Could not generate interview questions.');
    }
  };

  const leaveLive = async (shouldComplete = false) => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (localStreamRef.current && localStreamRef.current !== 'mock') {
      try {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
    }
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }
    
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    
    if (shouldComplete && user?.Role !== 'Candidate') {
      try {
        await axios.post(`/interviews/${liveRoomId}/complete`);
        fetchInterviews();
      } catch (e) {
        console.error("Failed to mark interview as completed", e);
      }
      setShowSummary(true);
    } else {
      setLiveOpen(false);
      setLiveRoomId(null);
      setLiveInterview(null);
      setLiveMessages([]);
      setCandidateDetail(null);
      setShowSummary(false);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current && localStreamRef.current !== 'mock') {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current && localStreamRef.current !== 'mock') {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    } else {
      setIsCameraOff(!isCameraOff);
    }
  };

  const handleAddTaggedNote = (tag) => {
    const text = liveInput.trim();
    if (!text) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newNote = {
      time: timestamp,
      tag: tag,
      text: text
    };
    
    const updated = [newNote, ...structuredNotes];
    setStructuredNotes(updated);
    setLiveInput('');
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        senderId: clientId,
        type: 'notes_sync',
        notes: updated
      }));
    }
  };

  const sendLiveMessage = () => {
    const text = liveInput.trim();
    if (!text) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newNote = {
      time: timestamp,
      tag: selectedTag,
      text: text
    };
    
    const updated = [newNote, ...structuredNotes];
    setStructuredNotes(updated);
    setLiveInput('');
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        senderId: clientId,
        type: 'notes_sync',
        notes: updated
      }));
    }
  };

  // Structured Notes Autosave Hook
  useEffect(() => {
    if (!liveOpen || !liveRoomId || structuredNotes.length === 0 || user?.Role === 'Candidate') return;
    
    const delayDebounce = setTimeout(async () => {
      try {
        await axios.patch(`/interviews/${liveRoomId}/notes`, {
          Notes: JSON.stringify(structuredNotes)
        });
      } catch (err) {
        console.error("Autosave failed:", err);
      }
    }, 2000);
    
    return () => clearTimeout(delayDebounce);
  }, [structuredNotes, liveOpen, liveRoomId]);

  // WebRTC signaling and WebSocket lifecycle hook
  useEffect(() => {
    if (!liveOpen || !liveRoomId) return;

    durationIntervalRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.hostname}:8000/interviews/ws/${liveRoomId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const initiateWebRTC = async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            senderId: clientId,
            type: 'candidate',
            candidate: event.candidate
          }));
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          setConnState('Connected');
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnState('Connected');
        } else if (pc.connectionState === 'connecting') {
          setConnState('Connecting');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnState('Reconnecting');
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      } catch (err) {
        console.warn("Failed to get local media stream:", err);
        setLocalStream('mock');
      }

      if (user?.Role === 'Recruiter') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({
            senderId: clientId,
            type: 'offer',
            sdp: offer
          }));
        } catch (e) {
          console.error("Failed to create offer:", e);
        }
      }
    };

    ws.onopen = () => {
      setLiveMessages(m => [...m, { text: 'Connected to live room.', system: true, time: Date.now() }]);
      setConnState('Connected');
      initiateWebRTC();
    };

    ws.onmessage = async (evt) => {
      let data;
      try {
        data = JSON.parse(evt.data);
      } catch (e) {
        setLiveMessages(m => [...m, { text: evt.data, system: false, time: Date.now() }]);
        return;
      }

      if (data.senderId === clientId) return;

      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({
            senderId: clientId,
            type: 'answer',
            sdp: answer
          }));
          setConnState('Connected');
        } else if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          setConnState('Connected');
        } else if (data.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else if (data.type === 'notes_sync') {
          if (user?.Role === 'Candidate') return;
          setStructuredNotes(data.notes);
        }
      } catch (err) {
        console.error("Signaling parsing error:", err);
      }
    };

    ws.onclose = () => {
      setLiveMessages(m => [...m, { text: 'Disconnected from live room.', system: true, time: Date.now() }]);
      setConnState('Disconnected');
    };

    ws.onerror = () => {
      setLiveMessages(m => [...m, { text: 'WebSocket connection error.', system: true, time: Date.now() }]);
    };

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      try { ws.close(); } catch (e) {}
      wsRef.current = null;
      if (localStreamRef.current && localStreamRef.current !== 'mock') {
        try {
          localStreamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {}
      }
      localStreamRef.current = null;
      if (peerConnectionRef.current) {
        try { peerConnectionRef.current.close(); } catch (e) {}
        peerConnectionRef.current = null;
      }
    };
  }, [liveOpen, liveRoomId]);

  // auto-scroll chat
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [liveMessages]);

  const renderNotes = (notesStr) => {
    if (!notesStr) return null;
    try {
      const parsed = JSON.parse(notesStr);
      if (Array.isArray(parsed)) {
        return (
          <div className="space-y-1 mt-3 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900/60 max-h-32 overflow-y-auto">
            <strong className="text-slate-350 block mb-1">Live Evaluation Log:</strong>
            {parsed.map((note, idx) => (
              <div key={idx} className="flex items-start space-x-1.5">
                <span className="text-indigo-400 font-semibold shrink-0">[{note.tag}]</span>
                <span className="text-slate-500 font-mono text-[9px] shrink-0">{note.time}:</span>
                <span className="text-slate-300 leading-snug">{note.text}</span>
              </div>
            ))}
          </div>
        );
      }
    } catch (e) {}
    
    return (
      <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 mt-3 leading-relaxed">
        <strong>Notes:</strong> {notesStr}
      </p>
    );
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

                    {renderNotes(itv.Notes)}
                  </div>

                  <div className="flex justify-end space-x-2 border-t border-slate-900/60 mt-4 pt-3.5">
                    {user?.Role !== 'Candidate' && (
                      <button
                        onClick={() => openRescheduleModal(itv)}
                        className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        <span>Reschedule</span>
                      </button>
                    )}
                    <button
                      onClick={() => joinLive(itv)}
                      aria-label={`Join live interview room ${itv.Interview_ID}`}
                      className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center"
                    >
                      <Video className="h-3 w-3 mr-1" />
                      <span>Start / Join Live</span>
                    </button>
                    {user?.Role !== 'Candidate' && (
                      <button
                        onClick={() => fetchSmartQuestions(itv.Job_ID, itv.Candidate_ID)}
                        className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        <span>Generate Questions</span>
                      </button>
                    )}
                    {user?.Role !== 'Candidate' && itv.Status !== 'Cancelled' && (
                      <button
                        onClick={() => handleCancelInterview(itv.Interview_ID, itv)}
                        className="px-2.5 py-1.5 border border-rose-950/30 hover:border-rose-900 bg-rose-950/10 hover:bg-rose-950/20 text-rose-400 rounded-lg text-[10px] font-bold transition flex items-center"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        <span>Cancel</span>
                      </button>
                    )}
                    {user?.Role !== 'Candidate' && (
                      <button
                        onClick={() => handleDeleteInterview(itv.Interview_ID)}
                        className="p-1.5 border border-slate-800 hover:border-red-950/30 text-slate-500 hover:text-rose-400 rounded-lg transition"
                        title="Permanently remove schedule log"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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
                <div className="col-span-2 text-center py-6 text-xs text-slate-500 italic">No past sessions.</div>
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

      {/* Live Fullscreen Video Call Screen */}
      {liveOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-slate-100 font-sans">
          
          {/* Header */}
          <header className="h-16 border-b border-slate-900 bg-slate-950/90 backdrop-blur-md px-6 flex justify-between items-center z-10 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                TL
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>Live Room {liveRoomId}</span>
                  <span className="text-slate-500 font-medium">·</span>
                  <span className="text-indigo-400 font-medium">
                    {liveInterview ? (user?.Role === 'Candidate' ? liveInterview.Job_Title : liveInterview.Candidate_Name) : 'Interview Session'}
                  </span>
                </h4>
              </div>
            </div>
            
            {/* Status & Timer */}
            <div className="flex items-center space-x-6">
              {/* Connection Status Pill */}
              <div className="flex items-center space-x-2">
                <span className={`h-2 w-2 rounded-full ${
                  connState === 'Connected' ? 'bg-emerald-500' :
                  connState === 'Connecting' ? 'bg-indigo-500 animate-pulse' :
                  connState === 'Reconnecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                }`}></span>
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">{connState}</span>
              </div>
              
              {/* Timer */}
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-xl">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-mono font-bold text-slate-200">
                  {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
                  {(callDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
              
              {/* Toggle Sidebar */}
              {user?.Role !== 'Candidate' && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`p-2 border rounded-xl transition ${sidebarOpen ? 'bg-indigo-650/15 border-indigo-900 text-indigo-400' : 'bg-slate-900 border-slate-850 text-slate-450 hover:text-slate-250'}`}
                  title="Toggle Candidate Context Sidebar"
                >
                  <Info className="h-4 w-4" />
                </button>
              )}
            </div>
          </header>

          {/* Body */}
          <div className="flex-1 flex overflow-hidden relative">
            
            {/* Left/Center: Video streams viewport */}
            <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 relative">
              
              {/* Primary Video Container */}
              <div className="w-full max-w-4xl aspect-video rounded-2xl bg-slate-900 border border-slate-850 relative overflow-hidden flex items-center justify-center shadow-2xl">
                
                {/* Remote Stream Video */}
                {remoteStream && remoteStream !== 'mock' ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  /* Waiting Placeholder */
                  <div className="text-center space-y-4">
                    <div className="relative inline-flex">
                      <span className="flex h-12 w-12 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-12 w-12 bg-indigo-550 flex items-center justify-center text-white">
                          <Video className="h-5 w-5" />
                        </span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold tracking-wide">
                      {user?.Role === 'Candidate' ? 'Connecting to Recruiter feed...' : 'Waiting for Candidate to connect...'}
                    </p>
                  </div>
                )}
                
                {/* PIP Local Stream Video (Corner overlay) */}
                <div className="absolute bottom-4 right-4 w-36 md:w-48 aspect-video rounded-xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center z-20">
                  {localStream && localStream !== 'mock' && !isCameraOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    /* Local Placeholder */
                    <div className="text-center p-2">
                      <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-extrabold text-[10px] mx-auto mb-1">
                        {user?.Name?.substring(0, 2).toUpperCase() || 'ME'}
                      </div>
                      <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                        {isCameraOff ? 'Camera Off' : 'Self View'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Call Controls Floating Bar */}
              <div className="absolute bottom-6 flex items-center space-x-3.5 bg-slate-900/90 border border-slate-850/80 p-3 px-6 rounded-2xl backdrop-blur-md shadow-2xl z-20">
                {/* Mute Audio button */}
                <button
                  onClick={toggleMute}
                  className={`p-3.5 rounded-xl font-bold transition flex items-center justify-center ${
                    isMuted 
                      ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30' 
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700'
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
                </button>

                {/* Toggle Camera button */}
                <button
                  onClick={toggleCamera}
                  className={`p-3.5 rounded-xl font-bold transition flex items-center justify-center ${
                    isCameraOff 
                      ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30' 
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700'
                  }`}
                  title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {isCameraOff ? <CameraOff className="h-4.5 w-4.5" /> : <Camera className="h-4.5 w-4.5" />}
                </button>

                {/* End Call/Leave Room button */}
                <button
                  onClick={() => leaveLive(true)}
                  className="px-5 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition active:scale-95 shadow-md flex items-center space-x-1.5"
                  title="Hang Up & End Interview"
                >
                  <Phone className="h-4 w-4 rotate-135" />
                  <span>{user?.Role === 'Candidate' ? 'Leave Room' : 'End Interview'}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Candidate Context Sidebar (Recruiter only) */}
            {user?.Role !== 'Candidate' && sidebarOpen && candidateDetail && (
              <div className="w-72 bg-slate-900 border-l border-slate-855 flex flex-col overflow-y-auto shrink-0 p-5 space-y-6 animate-in slide-in-from-right duration-300 relative z-25">
                <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300">Candidate Context</h4>
                  <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-slate-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Target Metadata */}
                <div className="space-y-1.5 bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wide">
                    {candidateDetail.recruiter_decision?.Recommendation || 'Evaluation Pending'}
                  </span>
                  <h5 className="font-extrabold text-slate-200 text-sm leading-tight">{candidateDetail.Name}</h5>
                  <p className="text-[10px] text-slate-400">{candidateDetail.Job_Title || 'Target Application'}</p>
                  
                  {/* Score Indicator */}
                  {candidateDetail.screening_results?.[0] && (
                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-905 mt-2">
                      <Award className="h-4 w-4 text-emerald-450" />
                      <span className="text-xs font-bold text-slate-300">AI Score: </span>
                      <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">
                        {Math.round(candidateDetail.screening_results[0].Overall_Score)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Parsed Skills */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Matched Skills</h5>
                  {!candidateDetail.skills || candidateDetail.skills.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">No matched skills extracted.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {candidateDetail.skills.map((sk, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-955 border border-slate-850 text-slate-300 rounded-lg text-[9px] font-bold">
                          {sk.Skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skill Gaps / Missing */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Identified Gaps</h5>
                  {candidateDetail.screening_results?.[0]?.Explanation?.missing_skills?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {candidateDetail.screening_results[0].Explanation.missing_skills.map((sk, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-rose-955/20 border border-rose-900/20 text-rose-400 rounded-lg text-[9px] font-bold">
                          {sk}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">No major skill gaps identified.</p>
                  )}
                </div>
              </div>
            )}

            {/* Right: Private Notes Panel (Recruiter only) */}
            {user?.Role !== 'Candidate' && (
              <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-850 flex flex-col shrink-0 relative z-30">
                <div className="p-4 border-b border-slate-850 flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-200 flex items-center space-x-1.5">
                    <MessageSquare className="h-4 w-4 text-brand-400" />
                    <span>Private Observations Log</span>
                  </h4>
                </div>

                {/* Notes log list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {structuredNotes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-600">
                      <Edit className="h-8 w-8 text-slate-705 mb-2" />
                      <p className="text-xs font-bold">No observations logged yet.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Type in the box below and click a tag button to add structured logs.</p>
                    </div>
                  ) : (
                    structuredNotes.map((note, index) => (
                      <div key={index} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1 hover:border-slate-800 transition-colors animate-in fade-in duration-200">
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold border-b border-slate-900/50 pb-1 mb-1">
                          <span className={`px-1.5 py-0.5 rounded font-black tracking-wide uppercase ${
                            note.tag === 'Strength' ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30' :
                            note.tag === 'Red Flag' ? 'text-rose-450 bg-rose-955/20 border border-rose-900/20 animate-pulse' :
                            note.tag === 'Technical' ? 'text-indigo-400 bg-indigo-950/20 border border-indigo-900/30' :
                            note.tag === 'Communication' ? 'text-sky-400 bg-sky-950/20 border border-sky-900/30' :
                            'text-amber-400 bg-amber-950/20 border border-amber-900/30'
                          }`}>
                            {note.tag}
                          </span>
                          <span>{note.time}</span>
                        </div>
                        <p className="text-xs text-slate-350 leading-relaxed font-medium">{note.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Note inputs */}
                <div className="p-4 border-t border-slate-850 bg-slate-950/30 space-y-3">
                  
                  {/* Quick-tag Buttons */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Quick Tag & Log</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Technical', 'Communication', 'Culture Fit', 'Red Flag', 'Strength'].map(tag => (
                        <button
                          key={tag}
                          onClick={() => handleAddTaggedNote(tag)}
                          disabled={!liveInput.trim()}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition border ${
                            !liveInput.trim() 
                              ? 'opacity-40 bg-slate-950 border-slate-900 text-slate-500 cursor-not-allowed'
                              : tag === 'Strength' ? 'bg-emerald-955/10 border-emerald-900 text-emerald-455 hover:bg-emerald-950/25 active:scale-95' :
                                tag === 'Red Flag' ? 'bg-rose-955/10 border-rose-900 text-rose-450 hover:bg-rose-955/20 active:scale-95' :
                                tag === 'Technical' ? 'bg-indigo-950/10 border-indigo-900 text-indigo-400 hover:bg-indigo-955/20 active:scale-95' :
                                tag === 'Communication' ? 'bg-sky-950/10 border-sky-900 text-sky-400 hover:bg-sky-950/25 active:scale-95' :
                                'bg-amber-950/10 border-amber-900 text-amber-400 hover:bg-amber-955/20 active:scale-95'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Free-form textbox */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 font-bold">Active Observation</span>
                    <div className="flex space-x-2">
                      <input
                        value={liveInput}
                        onChange={(e) => setLiveInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') sendLiveMessage(); }}
                        placeholder="Type observation here..."
                        className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-850 focus:border-brand-500 rounded-xl outline-none text-xs text-slate-100 placeholder-slate-500 transition-all font-medium"
                      />
                      <select
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className="bg-slate-950 border border-slate-850 px-2 py-1.5 rounded-xl text-[10px] font-bold text-slate-400 outline-none"
                      >
                        <option value="Technical">Tech</option>
                        <option value="Communication">Comm</option>
                        <option value="Culture Fit">Cult</option>
                        <option value="General">Gen</option>
                      </select>
                      <button 
                        onClick={sendLiveMessage} 
                        disabled={!liveInput.trim()}
                        className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-550 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition"
                      >
                        Log
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Post-Call Summary Modal View */}
          {showSummary && (
            <div className="fixed inset-0 z-70 bg-slate-950/95 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                <div className="space-y-2">
                  <div className="h-12 w-12 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 flex items-center justify-center mx-auto mb-3 animate-bounce">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">Session Completed</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    The live room has been closed and the session has been marked as Completed.
                  </p>
                </div>

                {/* Session Statistics */}
                <div className="grid grid-cols-2 gap-3.5 bg-slate-950/40 border border-slate-900 p-4 rounded-xl text-left">
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Call Duration</span>
                    <span className="text-sm font-extrabold text-slate-200">
                      {Math.floor(callDuration / 60)}m {callDuration % 60}s
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Logged Notes</span>
                    <span className="text-sm font-extrabold text-slate-200">
                      {structuredNotes.length} entries
                    </span>
                  </div>
                  
                  {/* Tag Breakdown list */}
                  <div className="col-span-2 border-t border-slate-900/50 pt-3 mt-1.5 space-y-2">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Observations Breakdown</span>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {['Strength', 'Red Flag', 'Technical', 'Communication'].map(tag => {
                        const count = structuredNotes.filter(n => n.tag === tag).length;
                        if (count === 0) return null;
                        return (
                          <span key={tag} className="text-[10px] font-bold px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-300">
                            {tag}: <strong className="text-indigo-400">{count}</strong>
                          </span>
                        );
                      })}
                      {structuredNotes.filter(n => !['Strength', 'Red Flag', 'Technical', 'Communication'].includes(n.tag)).length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-300">
                          Other: <strong className="text-indigo-400">
                            {structuredNotes.filter(n => !['Strength', 'Red Flag', 'Technical', 'Communication'].includes(n.tag)).length}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2.5 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setLiveOpen(false);
                      setLiveRoomId(null);
                      setLiveInterview(null);
                      setLiveMessages([]);
                      setCandidateDetail(null);
                      setShowSummary(false);
                    }}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl text-xs font-bold transition"
                  >
                    Return to Schedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Interviews;
