import React, { useState } from 'react';
import { ArrowLeft, KeyRound, LogIn, UserPlus } from 'lucide-react';
import { api } from '../api.js';

export default function AuthPage({ onAuth, onBack }) {
  const [mode, setMode] = useState('login');
  const [quick, setQuick] = useState(false);
  const [form, setForm] = useState({ username: '', userId: '', password: '', passId: '', resetCode: '' });
  const [notice, setNotice] = useState('');

  const set = e => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setNotice('');
    try {
      if (mode === 'signup') {
        const { data } = await api.post('/auth/signup', form);
        onAuth(data);
      } else if (mode === 'forgot') {
        const { data } = await api.post('/auth/forgot-password', { userId: form.userId });
        setNotice(data.resetCode ? `${data.message} Dev reset code: ${data.resetCode}` : data.message);
      } else if (mode === 'reset') {
        await api.post('/auth/reset-password', form);
        setNotice('Password changed. Log in with the new password.');
        setMode('login');
      } else {
        const url = quick ? '/auth/login/passid' : '/auth/login/password';
        const { data } = await api.post(url, form);
        onAuth(data);
      }
    } catch (error) {
      if (!error.response) {
        setNotice('Cannot reach the backend API. Start MongoDB, then run the server on http://localhost:5000.');
        return;
      }
      const details = error.response.data?.errors?.map(e => e.msg).join(', ');
      setNotice(error.response.data?.message || details || 'Request failed');
    }
  }

  return (
    <main className="min-h-screen bg-[#eef3f8] p-4 text-slate-900">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow"><ArrowLeft size={18}/> Calculator</button>
      <section className="mx-auto grid min-h-[82vh] max-w-5xl items-center gap-8 md:grid-cols-[1fr_420px]">
        <div>
          <h1 className="text-5xl font-black tracking-normal">Secret Calculator Chat</h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">The front door is deliberately boring. Past the code is a private real-time messenger with contacts, encrypted messages, media, and calls.</p>
        </div>
        <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-soft">
          <div className="mb-5 flex rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={() => setMode('login')} className={`flex-1 rounded-xl px-3 py-2 ${mode === 'login' ? 'bg-white shadow' : ''}`}><LogIn className="mx-auto" size={20}/></button>
            <button type="button" onClick={() => setMode('signup')} className={`flex-1 rounded-xl px-3 py-2 ${mode === 'signup' ? 'bg-white shadow' : ''}`}><UserPlus className="mx-auto" size={20}/></button>
            <button type="button" onClick={() => setMode('reset')} className={`flex-1 rounded-xl px-3 py-2 ${mode === 'reset' ? 'bg-white shadow' : ''}`}><KeyRound className="mx-auto" size={20}/></button>
          </div>
          <h2 className="mb-4 text-2xl font-bold">{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : mode === 'forgot' ? 'Forgot password' : 'Log in'}</h2>
          {mode === 'signup' && <input name="username" value={form.username} onChange={set} placeholder="Username" className="mb-3 w-full rounded-2xl border p-3" />}
          <input name="userId" value={form.userId} onChange={set} placeholder="User ID (5 digits)" maxLength="5" className="mb-3 w-full rounded-2xl border p-3" />
          {mode === 'reset' && <input name="resetCode" value={form.resetCode} onChange={set} placeholder="Reset code" maxLength="6" className="mb-3 w-full rounded-2xl border p-3" />}
          {mode === 'login' && (
            <label className="mb-3 flex items-center gap-3 text-sm text-slate-600">
              <input type="checkbox" checked={quick} onChange={e => setQuick(e.target.checked)} /> Use Pass ID quick login
            </label>
          )}
          {quick && mode === 'login'
            ? <input name="passId" value={form.passId} onChange={set} placeholder="Pass ID" className="mb-3 w-full rounded-2xl border p-3" />
            : mode !== 'forgot' && <input name="password" type="password" value={form.password} onChange={set} placeholder={mode === 'reset' ? 'New password' : 'Password'} className="mb-3 w-full rounded-2xl border p-3" />}
          {mode === 'signup' && <input name="passId" value={form.passId} onChange={set} placeholder="Pass ID (4-8 digits)" className="mb-3 w-full rounded-2xl border p-3" />}
          <button className="w-full rounded-2xl bg-[#1f6feb] py-3 font-bold text-white">{mode === 'signup' ? 'Sign up' : mode === 'reset' ? 'Reset password' : mode === 'forgot' ? 'Generate reset code' : 'Log in'}</button>
          {mode !== 'forgot' && <button type="button" onClick={() => setMode('forgot')} className="mt-3 w-full text-sm font-semibold text-slate-600">Forgot password</button>}
          {mode === 'forgot' && <button type="button" onClick={() => setMode('reset')} className="mt-3 w-full text-sm font-semibold text-slate-600">I have a reset code</button>}
          {notice && <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm">{notice}</p>}
        </form>
      </section>
    </main>
  );
}
