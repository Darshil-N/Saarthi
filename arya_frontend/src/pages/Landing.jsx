import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Brain, FileText, MessageSquare, TrendingUp, Shield, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CNMC_STAGES = [
  'MECH',
  'MECH-FSTNR',
  'MECH-FSTNR-BOLT',
  'MECH-FSTNR-BOLT-M8X25',
  'MECH-FSTNR-BOLT-M8X25-SS304',
  'MECH-FSTNR-BOLT-M8X25-SS304-A'
];

export default function Landing() {
  const navigate = useNavigate();
  const [cnmcIndex, setCnmcIndex] = useState(0);

  useEffect(() => {
    const isLast = cnmcIndex === CNMC_STAGES.length - 1;
    const timer = setTimeout(() => {
      setCnmcIndex((i) => (i + 1) % CNMC_STAGES.length);
    }, isLast ? 2000 : 700);
    return () => clearTimeout(timer);
  }, [cnmcIndex]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <Droplets className="h-8 w-8 text-blue-600" />
          <div>
            <span className="font-bold text-xl tracking-tight">Saarthi</span>
            <span className="ml-2 text-sm text-slate-500 font-medium border-l border-slate-300 pl-2">BharatOil</span>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/login')} className="font-semibold px-6">
          Login to Portal
        </Button>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white py-24 px-8 text-center flex flex-col items-center">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          One Nation. One Material Code.
        </h1>
        <p className="text-xl md:text-2xl text-blue-200 font-medium mb-12 max-w-3xl">
          AI-powered material master data management for India's energy sector.
        </p>

        {/* Animated CNMC */}
        <div className="bg-black/30 p-6 rounded-xl border border-white/10 mb-12 min-h-[100px] flex items-center justify-center min-w-[300px] md:min-w-[600px] shadow-2xl backdrop-blur-sm">
          <div className="font-mono text-2xl md:text-4xl tracking-wider font-bold transition-all duration-300">
            {CNMC_STAGES[cnmcIndex].split('-').map((segment, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-white/40 mx-2">-</span>}
                <span className="text-cyan-300">{segment}</span>
              </React.Fragment>
            ))}
            <span className="animate-pulse text-white/50 ml-2">_</span>
          </div>
        </div>

        <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-10 h-14 bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/30 border-0">
          Get Started
        </Button>
      </section>

      {/* Problem Statement */}
      <section className="py-20 px-8 bg-white text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-12">The Problem with Material Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            { num: '43,000+', desc: 'duplicate material codes currently active' },
            { num: '₹2,400 Cr', desc: 'procurement budget wasted annually due to poor visibility' },
            { num: '72 hrs', desc: 'average time to onboard a new material via legacy ERPs' }
          ].map((stat, i) => (
            <div key={i} className="p-8 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
              <div className="text-5xl font-extrabold text-blue-600 mb-4">{stat.num}</div>
              <div className="text-lg text-slate-600 font-medium">{stat.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 px-8 bg-slate-50 border-y border-slate-200">
        <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Platform Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[
            { icon: FileText, title: 'OCR Intake', desc: 'Digitize paper bills instantly using Google Gemini Vision AI.' },
            { icon: Brain, title: 'AI Matching', desc: 'Deduplicate incoming materials against the master catalog with 97% accuracy.' },
            { icon: MessageSquare, title: 'NL Query', desc: 'Search and query your massive material catalog in plain English.' },
            { icon: TrendingUp, title: 'Price Intelligence', desc: 'Track vendor price trends and anomalies across different regions.' },
            { icon: Shield, title: 'Quality Tracking', desc: 'Enforce grade-based quality workflows for every inbound material.' },
            { icon: ScrollText, title: 'Audit Trail', desc: 'Maintain immutable, cryptographic logs for every material master change.' }
          ].map((cap, i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <cap.icon className="h-10 w-10 text-blue-500 mb-4" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">{cap.title}</h3>
              <p className="text-slate-600">{cap.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Stats */}
      <section className="py-16 px-8 bg-slate-900 text-white text-center">
        <h2 className="text-2xl font-bold mb-2">BharatOil Material Master — Live Stats</h2>
        <p className="text-slate-400 mb-10">Data updates live via Saarthi AI pipeline</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto divide-x divide-white/10">
          {[
            { num: '1,24,892', label: 'Active Material Codes' },
            { num: '3,847', label: 'Pending Deduplication' },
            { num: '₹890 Cr', label: 'Estimated Savings' },
            { num: '99.2%', label: 'Data Accuracy Score' }
          ].map((stat, i) => (
            <div key={i} className="px-4">
              <div className="text-3xl md:text-4xl font-bold text-blue-400 mb-2">{stat.num}</div>
              <div className="text-sm text-slate-300 font-medium uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 text-center text-slate-500 text-sm">
        <p>Saarthi © 2026 BharatOil — One Nation. One Material Code.</p>
      </footer>
    </div>
  );
}
