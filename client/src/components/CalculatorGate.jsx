import React, { useState } from 'react';

const keys = ['7','8','9','/','4','5','6','*','1','2','3','-','0','.','+','='];
const funny = ['18', '77', '404', 'NaN-ish', '42.0001', 'banana', '999', '-3'];

export default function CalculatorGate({ onSecret }) {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');

  function press(key) {
    if (key === '=') {
      if (expr === '+914+') return onSecret();
      setResult(funny[Math.floor(Math.random() * funny.length)]);
      return;
    }
    setExpr(v => (v + key).slice(-28));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d7f4ef,#eef3f8_35%,#f7e8df)] flex items-center justify-center p-5">
      <section className="w-full max-w-sm rounded-[2rem] bg-[#111827] p-5 shadow-soft">
        <div className="mb-5 rounded-3xl bg-[#eef3f8] p-5 text-right">
          <div className="min-h-8 break-words text-lg text-slate-500">{expr || '0'}</div>
          <div className="mt-2 text-5xl font-semibold tracking-normal text-slate-950">{result}</div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <button onClick={() => { setExpr(''); setResult('0'); }} className="col-span-2 rounded-2xl bg-rose-500 py-4 text-lg font-bold text-white">AC</button>
          <button onClick={() => setExpr(v => v.slice(0, -1))} className="rounded-2xl bg-slate-600 py-4 text-lg font-bold text-white">⌫</button>
          <button onClick={() => press('+')} className="rounded-2xl bg-amber-500 py-4 text-lg font-bold text-white">+</button>
          {keys.slice(0, 15).map(key => (
            <button key={key} onClick={() => press(key)} className={`rounded-2xl py-4 text-xl font-bold ${'/*-+'.includes(key) ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-50'}`}>{key}</button>
          ))}
          <button onClick={() => press('=')} className="rounded-2xl bg-emerald-500 py-4 text-xl font-bold text-white">=</button>
        </div>
      </section>
    </main>
  );
}
