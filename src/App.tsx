/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search,
  Zap,
  Globe,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || 'http://localhost:8787';
const SEARCH_TERM_MAX_LENGTH = 80;
const SEARCH_DISALLOWED_CHARS = /[^a-zA-Z0-9\s\-'&]/g;

function sanitizeSearchInput(value: string): string {
  return value.replace(SEARCH_DISALLOWED_CHARS, '').slice(0, SEARCH_TERM_MAX_LENGTH);
}

function isSafeValidationText(value: string, maxLength: number): boolean {
  if (value.length === 0 || value.length > maxLength) {
    return false;
  }

  return /^[a-zA-Z0-9\s.,'"()\-_/&:+#%!?;=]+$/.test(value);
}

interface Accelerator {
  name: string;
  url: string;
  prerequisites: string;
  category: string;
  status: 'validating' | 'valid' | 'broken' | 'unknown';
  lastChecked?: string;
}

const INITIAL_ACCELERATORS: Accelerator[] = [
  { name: 'Y Combinator', url: 'https://www.ycombinator.com/apply', prerequisites: 'Early-stage startup, technical co-founder preferred, scalable idea.', category: 'Global', status: 'unknown' },
  { name: 'Techstars', url: 'https://www.techstars.com/accelerators', prerequisites: 'Strong team, product-market fit potential, scalable technology.', category: 'Global', status: 'unknown' },
  { name: '500 Global', url: 'https://500.co/accelerators', prerequisites: 'Post-revenue or strong traction, diverse teams, global focus.', category: 'Global', status: 'unknown' },
  { name: 'Antler', url: 'https://www.antler.co/apply', prerequisites: 'Individual founders or teams, pre-idea or early stage.', category: 'Global', status: 'unknown' },
  { name: 'Entrepreneur First', url: 'https://www.joinef.com/', prerequisites: 'Talented individuals, pre-team, pre-idea, technical background.', category: 'Global', status: 'unknown' },
  { name: 'Alchemist Accelerator', url: 'https://www.alchemistaccelerator.com/apply', prerequisites: 'Enterprise-focused (B2B), technical founders.', category: 'Niche', status: 'unknown' },
  { name: 'Plug and Play', url: 'https://www.plugandplaytechcenter.com/startups/', prerequisites: 'Industry-specific focus, later stage often preferred.', category: 'Corporate', status: 'unknown' },
  { name: 'MassChallenge', url: 'https://masschallenge.org/programs', prerequisites: 'Early-stage, high-impact, zero-equity model.', category: 'Global', status: 'unknown' },
  { name: 'Village Global', url: 'https://www.villageglobal.vc/accelerator', prerequisites: 'Early-stage, network-driven, diverse sectors.', category: 'Global', status: 'unknown' },
  { name: 'Startupbootcamp', url: 'https://www.startupbootcamp.org/', prerequisites: 'Industry-focused programs, global presence.', category: 'Global', status: 'unknown' },
  { name: 'Seedcamp', url: 'https://seedcamp.com/apply/', prerequisites: 'European focus, pre-seed/seed stage, high growth potential.', category: 'Regional', status: 'unknown' },
  { name: 'Founders Factory', url: 'https://foundersfactory.com/', prerequisites: 'Corporate-backed, sector-specific, early stage.', category: 'Corporate', status: 'unknown' },
];

export default function App() {
  const [accelerators, setAccelerators] = useState<Accelerator[]>(INITIAL_ACCELERATORS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(300); // 5 minutes refresh cycle
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAccelerators = accelerators.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validateLink = useCallback(async (acc: Accelerator) => {
    try {
      if (!isSafeValidationText(acc.name, 120) || !isSafeValidationText(acc.prerequisites, 1000)) {
        throw new Error('Rejected malformed accelerator validation input on client guardrail.');
      }

      let normalizedUrl = acc.url.trim();
      try {
        normalizedUrl = new URL(normalizedUrl).toString();
      } catch {
        throw new Error('Rejected malformed URL before validation request.');
      }

      const response = await fetch(`${API_BASE_URL}/api/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: acc.name,
          url: normalizedUrl,
          prerequisites: acc.prerequisites,
        }),
      });

      if (!response.ok) {
        throw new Error(`Validation API error: ${response.status}`);
      }

      const result = await response.json() as {
        isLive?: boolean;
        confirmedUrl?: string;
        currentPrerequisites?: string;
      };
      
      return {
        ...acc,
        url: result.confirmedUrl || acc.url,
        prerequisites: result.currentPrerequisites || acc.prerequisites,
        status: result.isLive ? 'valid' : 'broken',
        lastChecked: new Date().toLocaleTimeString()
      } as Accelerator;
    } catch (error) {
      console.error(`Error validating ${acc.name}:`, error);
      return { ...acc, status: 'unknown', lastChecked: new Date().toLocaleTimeString() } as Accelerator;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    const updated = await Promise.all(
      accelerators.map(async (acc) => {
        setAccelerators(prev => prev.map(p => p.name === acc.name ? { ...p, status: 'validating' } : p));
        return await validateLink(acc);
      })
    );
    setAccelerators(updated);
    setIsRefreshing(false);
    setLastRefresh(new Date());
    setCountdown(300);
  }, [accelerators, validateLink]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refreshAll();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshAll]);

  // Initial validation
  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <div className="flex items-center gap-2 text-orange-500 mb-4">
              <Zap size={20} fill="currentColor" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase">Live Accelerator Pulse</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-4">
              THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">DASHBOARD</span>
            </h1>
            <p className="text-zinc-400 max-w-md text-lg leading-relaxed">
              Real-time tracking of YC and top global accelerators. 
              Verified links and prerequisites as of <span className="text-white font-medium">March 26, 2026</span>.
            </p>

            <div className="mt-8 relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="text" 
                placeholder="Search accelerators..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(sanitizeSearchInput(e.target.value))}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            <div className="flex items-center gap-8 bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
              <div className="text-right">
                <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Next Auto-Refresh</div>
                <div className="text-2xl font-mono font-bold flex items-center gap-2">
                  <Clock size={18} className="text-orange-500" />
                  {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <button 
                onClick={refreshAll}
                disabled={isRefreshing}
                className="group relative flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-orange-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                {isRefreshing ? 'VALIDATING...' : 'REFRESH NOW'}
              </button>
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
              Last Pulse: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredAccelerators.map((acc, index) => (
              <motion.div
                key={acc.name}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group relative bg-zinc-900/40 backdrop-blur-sm border border-white/5 p-8 rounded-3xl hover:border-white/20 transition-all"
              >
                {/* Status Indicator */}
                <div className="absolute top-8 right-8">
                  {acc.status === 'validating' ? (
                    <RefreshCw size={20} className="text-blue-400 animate-spin" />
                  ) : acc.status === 'valid' ? (
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  ) : acc.status === 'broken' ? (
                    <AlertCircle size={20} className="text-red-400" />
                  ) : (
                    <Clock size={20} className="text-zinc-600" />
                  )}
                </div>

                <div className="mb-8">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">{acc.category}</div>
                  <h3 className="text-3xl font-bold tracking-tight mb-4">{acc.name}</h3>
                  <a 
                    href={acc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-mono break-all"
                  >
                    <Globe size={14} />
                    {acc.url.replace('https://', '')}
                    <ExternalLink size={14} />
                  </a>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-orange-500/30 transition-colors">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">
                      <Search size={12} />
                      Application Info
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[9px] text-zinc-500 uppercase mb-1">Direct Link</div>
                        <a 
                          href={acc.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-blue-400 hover:underline break-all block"
                        >
                          {acc.url}
                        </a>
                      </div>
                      <div>
                        <div className="text-[9px] text-zinc-500 uppercase mb-1">Prerequisites</div>
                        <p className="text-sm text-zinc-300 leading-relaxed font-mono">
                          {acc.prerequisites}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-widest">
                  <span>Checked: {acc.lastChecked || 'Never'}</span>
                  <span className={`font-bold ${
                    acc.status === 'valid' ? 'text-emerald-500' : 
                    acc.status === 'broken' ? 'text-red-500' : 
                    'text-zinc-500'
                  }`}>
                    {acc.status.toUpperCase()}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        <footer className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center font-black italic">YC</div>
            <div className="text-xs text-zinc-500 max-w-[200px]">
              Data validated using Gemini 3.1 Flash with Google Search Grounding.
            </div>
          </div>
          <div className="flex gap-8 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
