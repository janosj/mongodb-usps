import React, { useState } from 'react';
import { api } from './api';
import LiveDecisions from './components/LiveDecisions';
import Investigate from './components/Investigate';
import DataFeeds from './components/DataFeeds';

const TABS = [
  { id: 'fast', label: '1 · Be fast: Live decisions' },
  { id: 'smart', label: '2 · Be smart: Investigate' },
  { id: 'flex', label: '3 · Stay flexible: Evolving data feeds' },
];

export default function App() {
  const [tab, setTab] = useState('fast');
  const [seedingState, setSeedingState] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [resetKey, setResetKey] = useState(0);

  const handleSeed = async () => {
    setSeedingState('loading');
    try {
      await api.post('/seed');
      setResetKey((k) => k + 1); // remount every tab with fresh state
      setSeedingState('success');
      setTimeout(() => setSeedingState('idle'), 2500);
    } catch (err) {
      console.error(err);
      alert(`Reset failed: ${err.response?.data?.error || err.message}`);
      setSeedingState('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* USPS Header */}
      <header className="bg-[#004B87] text-white px-8 py-4 flex items-center justify-between shadow-md border-b-4 border-[#DA291C]">
        <div className="flex items-center space-x-4">
          <div className="bg-white text-[#004B87] font-black text-xl px-2.5 py-1 rounded tracking-tighter">USPS</div>
          <h1 className="text-xl font-bold tracking-tight">Fraud, Waste, and Abuse Platform</h1>
        </div>
        <button
          onClick={handleSeed}
          disabled={seedingState === 'loading'}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded transition shadow-sm border ${
            seedingState === 'loading'
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/40 cursor-wait'
              : seedingState === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-white/10 hover:bg-white/20 border-white/30 text-white'
          }`}
        >
          {seedingState === 'loading' && '↻ Resetting Demo State...'}
          {seedingState === 'success' && '✓ Demo State Restored!'}
          {seedingState === 'idle' && 'Reset Demo Data'}
        </button>
      </header>

      <nav className="bg-white border-b border-slate-200 px-8">
        <div className="max-w-7xl mx-auto flex space-x-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-4 transition ${
                tab === t.id ? 'border-[#004B87] text-[#004B87]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {tab === 'fast' && <LiveDecisions key={`fast-${resetKey}`} />}
        {tab === 'smart' && <Investigate key={`smart-${resetKey}`} />}
        {tab === 'flex' && <DataFeeds key={`flex-${resetKey}`} />}
        <p className="text-[11px] text-slate-400 mt-8 text-center">All data in this demo is synthetic.</p>
      </main>
    </div>
  );
}
