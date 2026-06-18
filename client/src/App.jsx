import React, { useEffect, useState } from 'react';
import CalculatorGate from './components/CalculatorGate.jsx';
import AuthPage from './components/AuthPage.jsx';
import ChatApp from './components/ChatApp.jsx';
import { api } from './api.js';

export default function App() {
  const [screen, setScreen] = useState('calculator');
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('scc_token');
    const user = localStorage.getItem('scc_user');
    return token && user ? { token, user: JSON.parse(user) } : null;
  });

  useEffect(() => {
    if (!session?.token) return;
    api.get('/auth/me').then(({ data }) => {
      setSession(s => ({ ...s, user: data.user }));
      setScreen('chat');
    }).catch(() => {
      localStorage.removeItem('scc_token');
      localStorage.removeItem('scc_user');
      setSession(null);
      setScreen('calculator');
    });
  }, []);

  function saveSession(data) {
    localStorage.setItem('scc_token', data.token);
    localStorage.setItem('scc_user', JSON.stringify(data.user));
    setSession(data);
    setScreen('chat');
  }

  function logout() {
    localStorage.removeItem('scc_token');
    localStorage.removeItem('scc_user');
    setSession(null);
    setScreen('calculator');
  }

  if (screen === 'auth') return <AuthPage onAuth={saveSession} onBack={() => setScreen('calculator')} />;
  if (screen === 'chat' && session) return <ChatApp session={session} onLogout={logout} />;
  return <CalculatorGate onSecret={() => setScreen('auth')} />;
}
