import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Camera,
  Download,
  ExternalLink,
  FileUp,
  Image,
  LogOut,
  Mic,
  Moon,
  Phone,
  Search,
  Send,
  Smile,
  Sun,
  Trash2,
  UserPlus,
  Video,
  X,
  ZoomIn
} from 'lucide-react';
import { api, API_URL } from '../api.js';
import { decryptText, encryptText } from '../crypto.js';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

export default function ChatApp({ session, onLogout }) {
  const [currentUser, setCurrentUser] = useState(session.user);
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [online, setOnline] = useState({});
  const [emoji, setEmoji] = useState(false);
  const [dark, setDark] = useState(false);
  const [call, setCall] = useState(null);
  const [streams, setStreams] = useState({ local: null, remote: null });
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState('');
  const [viewer, setViewer] = useState(null);
  const socketRef = useRef(null);
  const callRef = useRef(null);
  const streamsRef = useRef({ local: null, remote: null });
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const remoteAudio = useRef(null);
  const peerRef = useRef(null);
  const recorder = useRef(null);
  const recorderStream = useRef(null);

  const socket = useMemo(() => io(API_URL, { auth: { token: session.token } }), [session.token]);

  useEffect(() => {
    socketRef.current = socket;
    socket.on('presence:update', p => setOnline(o => ({ ...o, [p.userId]: p.online })));
    socket.on('message:new', m => {
      setMessages(list => list.some(x => x._id === m._id) ? list : [...list, m]);
    });
    socket.on('message:status', p => {
      setMessages(list => list.map(m => m._id === p.id ? { ...m, status: p.status } : m));
    });
    socket.on('call:offer', data => setCall({ incoming: true, ...data }));
    socket.on('call:answer', data => peerRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer)));
    socket.on('call:ice', data => data.candidate && peerRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate)));
    socket.on('call:end', () => endCall(false));
    loadContacts();
    return () => socket.disconnect();
  }, [socket]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    if (!active) return;
    api.get(`/messages?with=${active._id}`).then(({ data }) => setMessages(data.messages));
  }, [active?._id]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    streamsRef.current = streams;
    if (localVideo.current && streams.local) localVideo.current.srcObject = streams.local;
    if (remoteVideo.current && streams.remote) remoteVideo.current.srcObject = streams.remote;
    if (remoteAudio.current && streams.remote) remoteAudio.current.srcObject = streams.remote;
  }, [streams, call]);

  async function loadContacts() {
    const { data } = await api.get('/contacts');
    setContacts(data.contacts);
    setActive(a => a || data.contacts[0] || null);
  }

  async function searchUsers(value) {
    setSearch(value);
    if (!/^\d{1,5}$/.test(value)) return setResults([]);
    const { data } = await api.get(`/users/search?userId=${value}`);
    setResults(data.users);
  }

  async function addContact(userId) {
    await api.post('/contacts', { userId });
    setSearch('');
    setResults([]);
    loadContacts();
  }

  async function send(type = 'text', content = text, fileName = '') {
    if (!active || !content.trim()) return;
    const payload = { receiverId: active._id, type, content, fileName };
    if (type === 'text') Object.assign(payload, await encryptText(content, currentUser, active));
    socket.emit('message:send', payload);
    setText('');
    setEmoji(false);
  }

  async function upload(file, type) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/uploads', form);
    send(type, `${API_URL}${data.url}`, data.fileName);
  }

  async function uploadProfile(file) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/uploads', form);
    const updated = await api.patch('/users/profile', { profilePhoto: `${API_URL}${data.url}` });
    localStorage.setItem('scc_user', JSON.stringify(updated.data.user));
    setCurrentUser(updated.data.user);
  }

  async function deleteMessage(id) {
    await api.delete(`/messages/${id}`);
    setMessages(list => list.filter(m => m._id !== id));
  }

  async function startRecording(event) {
    event?.preventDefault();
    if (!active || recording || recorder.current?.state === 'recording') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const chunks = [];
      recorderStream.current = stream;
      recorder.current = new MediaRecorder(stream, { mimeType });
      recorder.current.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.current.onerror = () => {
        setNotice('Voice recording failed. Check microphone permission.');
        stopRecording();
      };
      recorder.current.onstop = async () => {
        recorderStream.current?.getTracks().forEach(track => track.stop());
        recorderStream.current = null;
        setRecording(false);
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await upload(new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }), 'voice');
      };
      setNotice('');
      setRecording(true);
      recorder.current.start();
    } catch {
      setRecording(false);
      setNotice('Microphone permission is needed to send voice messages.');
    }
  }

  function stopRecording(event) {
    event?.preventDefault();
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  async function setupPeer(video = false, target = active?._id) {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerRef.current = peer;
    peer.onicecandidate = e => e.candidate && socket.emit('call:ice', { to: target, candidate: e.candidate });
    peer.ontrack = e => setStreams(s => ({ ...s, remote: e.streams[0] }));
    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) endCall(false);
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    setStreams(s => ({ ...s, local: stream }));
    return peer;
  }

  async function startCall(video = false) {
    if (!active) return;
    try {
      setCall({ to: active._id, video, outgoing: true });
      setNotice('');
      const peer = await setupPeer(video);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('call:offer', { to: active._id, offer, video });
    } catch {
      setNotice('Camera or microphone permission is needed to start a call.');
      endCall(false);
    }
  }

  async function acceptCall() {
    try {
      const peer = await setupPeer(call.video, call.from);
      await peer.setRemoteDescription(new RTCSessionDescription(call.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('call:answer', { to: call.from, answer });
      setCall(c => ({ ...c, incoming: false, connected: true }));
    } catch {
      setNotice('Camera or microphone permission is needed to answer the call.');
      endCall(true);
    }
  }

  function endCall(emit = true) {
    const currentCall = callRef.current;
    const currentStreams = streamsRef.current;
    peerRef.current?.getSenders().forEach(s => s.track?.stop());
    currentStreams.local?.getTracks().forEach(track => track.stop());
    currentStreams.remote?.getTracks().forEach(track => track.stop());
    peerRef.current?.close();
    peerRef.current = null;
    if (emit && (currentCall?.to || currentCall?.from)) socket.emit('call:end', { to: currentCall.to || currentCall.from });
    setCall(null);
    setStreams({ local: null, remote: null });
  }

  const visible = messages.filter(m => active && [m.senderId, m.receiverId].includes(active._id));

  return (
    <main className={`h-screen bg-[#eef3f8] text-slate-900 dark:bg-[#101722] dark:text-slate-100 ${dark ? 'dark' : ''}`}>
      <div className="grid h-full md:grid-cols-[330px_1fr]">
        <aside className="border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#151f2d]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="relative grid h-11 w-11 cursor-pointer place-items-center overflow-hidden rounded-2xl bg-[#1f6feb] font-black text-white">
                {currentUser.profilePhoto ? <img src={currentUser.profilePhoto} className="h-full w-full object-cover" /> : currentUser.username[0]}
                <Camera className="absolute bottom-1 right-1 rounded-full bg-black/50 p-0.5" size={16} />
                <input type="file" accept="image/*" hidden onChange={e => uploadProfile(e.target.files[0])} />
              </label>
              <div><div className="font-bold">{currentUser.username}</div><div className="text-xs text-slate-500">#{currentUser.userId}</div></div>
            </div>
            <button onClick={onLogout} title="Logout" className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut size={20} /></button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input value={search} onChange={e => searchUsers(e.target.value)} placeholder="Search User ID" className="w-full rounded-2xl border bg-transparent py-3 pl-10 pr-3 dark:border-slate-700" />
          </div>
          {results.map(u => <button key={u._id} onClick={() => addContact(u.userId)} className="mb-2 flex w-full items-center justify-between rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"><span>{u.username} #{u.userId}</span><UserPlus size={18} /></button>)}
          <div className="scrollbar mt-4 max-h-[calc(100vh-190px)] overflow-auto">
            {contacts.map(c => (
              <button key={c._id} onClick={() => setActive(c)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left ${active?._id === c._id ? 'bg-[#dceaff] dark:bg-[#243957]' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-slate-300 font-bold text-slate-800">{c.username[0]}<i className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${online[c._id] ? 'bg-emerald-500' : 'bg-slate-400'}`} /></span>
                <span><b>{c.username}</b><small className="block text-slate-500">#{c.userId}</small></span>
              </button>
            ))}
          </div>
        </aside>
        <section className="grid min-h-0 grid-rows-[74px_1fr_auto]">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-[#151f2d]">
            <div><b>{active?.username || 'Add a contact'}</b><div className="text-xs text-slate-500">{active && (online[active._id] ? 'Online' : 'Offline')}</div></div>
            <div className="flex gap-2">
              <button onClick={() => setDark(!dark)} title="Dark mode" className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800">{dark ? <Sun /> : <Moon />}</button>
              <button onClick={() => startCall(false)} title="Voice call" className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Phone /></button>
              <button onClick={() => startCall(true)} title="Video call" className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Video /></button>
            </div>
          </header>
          <div className="scrollbar min-h-0 overflow-auto p-4">
            {notice && <div className="mb-3 rounded-2xl bg-amber-100 p-3 text-sm text-amber-900">{notice}</div>}
            {visible.map(m => <MessageBubble key={m._id} message={m} mine={m.senderId === currentUser.id || m.senderId === currentUser._id} me={currentUser} active={active} onDelete={deleteMessage} onViewImage={setViewer} />)}
          </div>
          <footer className="relative border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#151f2d]">
            {emoji && <div className="absolute bottom-20 left-4 z-10"><Suspense fallback={<div className="rounded-2xl bg-white p-4 shadow">Loading...</div>}><EmojiPicker onEmojiClick={e => setText(t => t + e.emoji)} /></Suspense></div>}
            <div className="flex items-center gap-2">
              <button onClick={() => setEmoji(!emoji)} title="Emoji" className="rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800"><Smile /></button>
              <button onClick={() => send('sticker', '*')} title="Sticker" className="rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800">*</button>
              <label title="Image" className="cursor-pointer rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800"><Image /><input type="file" accept="image/*" hidden onChange={e => upload(e.target.files[0], 'image')} /></label>
              <label title="File" className="cursor-pointer rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800"><FileUp /><input type="file" hidden onChange={e => upload(e.target.files[0], 'file')} /></label>
              <button
                onPointerDown={startRecording}
                onPointerUp={stopRecording}
                onPointerCancel={stopRecording}
                onPointerLeave={recording ? stopRecording : undefined}
                title="Hold to record"
                className={`rounded-xl p-3 ${recording ? 'bg-rose-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              ><Mic /></button>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message" className="min-w-0 flex-1 rounded-2xl border bg-transparent px-4 py-3 dark:border-slate-700" />
              <button onClick={() => send()} title="Send" className="rounded-2xl bg-[#1f6feb] p-3 text-white"><Send /></button>
            </div>
          </footer>
        </section>
      </div>
      {call && <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4">
        <div className="w-full max-w-2xl rounded-3xl bg-white p-5 text-slate-900 shadow-soft">
          <div className="mb-4 flex items-center justify-between"><b>{call.incoming ? `Incoming ${call.video ? 'video' : 'voice'} call` : `${call.video ? 'Video' : 'Voice'} call`}</b><button onClick={() => endCall(true)}><X /></button></div>
          {call.video ? <div className="grid gap-3 md:grid-cols-2">
            <video ref={localVideo} autoPlay muted playsInline className="aspect-video w-full rounded-2xl bg-slate-900 object-cover" />
            <video ref={remoteVideo} autoPlay playsInline className="aspect-video w-full rounded-2xl bg-slate-900 object-cover" />
          </div> : <div className="grid place-items-center rounded-2xl bg-slate-100 p-10 text-center">
            <Phone size={44} />
            <p className="mt-3 font-semibold">{call.incoming ? 'Answer to connect audio' : 'Waiting for audio connection'}</p>
            <audio ref={remoteAudio} autoPlay playsInline />
          </div>}
          <div className="mt-4 flex gap-3">{call.incoming && <button onClick={acceptCall} className="rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-white"><Phone className="inline" /> Accept</button>}<button onClick={() => endCall(true)} className="rounded-2xl bg-rose-500 px-5 py-3 font-bold text-white">End</button></div>
        </div>
      </div>}
      {viewer && <div className="fixed inset-0 z-30 grid place-items-center bg-black/85 p-4">
        <div className="flex max-h-full w-full max-w-5xl flex-col">
          <div className="mb-3 flex justify-end gap-2">
            <a href={viewer} target="_blank" className="rounded-xl bg-white/90 p-3 text-slate-900" title="Open image"><ExternalLink /></a>
            <a href={viewer} download className="rounded-xl bg-white/90 p-3 text-slate-900" title="Download image"><Download /></a>
            <button onClick={() => setViewer(null)} className="rounded-xl bg-white/90 p-3 text-slate-900" title="Close"><X /></button>
          </div>
          <img src={viewer} className="max-h-[82vh] w-full rounded-2xl object-contain" />
        </div>
      </div>}
    </main>
  );
}

function MessageBubble({ message, mine, me, active, onDelete, onViewImage }) {
  const [body, setBody] = useState(message.content);
  useEffect(() => {
    if (message.type === 'text' && active) decryptText(message, me, active).then(setBody);
    else setBody(message.content);
  }, [message, active?._id]);
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return <div className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-[78%] rounded-2xl p-3 ${mine ? 'bg-[#1f6feb] text-white' : 'bg-white dark:bg-slate-800'}`}>
      {message.type === 'image' && <button onClick={() => onViewImage(message.content)} className="group relative mb-2 block overflow-hidden rounded-xl text-left"><img src={message.content} className="max-h-72 rounded-xl" /><span className="absolute inset-0 hidden place-items-center bg-black/35 text-white group-hover:grid"><ZoomIn /></span></button>}
      {message.type === 'voice' && <audio src={message.content} controls className="max-w-full" />}
      {message.type === 'file' && <a href={message.content} target="_blank" className="font-bold underline">{message.fileName || 'Download file'}</a>}
      {(message.type === 'text' || message.type === 'sticker') && <p className="break-words">{body}</p>}
      <div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70"><span>{time}</span><span>{mine ? message.status : ''}</span><button onClick={() => onDelete(message._id)} title="Delete message"><Trash2 size={12} /></button></div>
    </div>
  </div>;
}
