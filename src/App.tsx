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

const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '';
const SEARCH_TERM_MAX_LENGTH = 80;
const SEARCH_DISALLOWED_CHARS = /[^a-zA-Z0-9\s\-'&]/g;
const ACCELERATOR_CACHE_KEY = 'fundingdash:accelerator-cache';
const ACCELERATOR_CACHE_VERSION = 1;
const TARGET_RETURN_MULTIPLE = 100;

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

interface AcceleratorCachePayload {
  version: number;
  accelerators: Accelerator[];
  lastRefreshIso: string;
}

interface FundingProgramRecord {
  name?: string;
  url?: string;
  prerequisites?: string;
  category?: string;
}

function normalizeProgram(record: FundingProgramRecord): Accelerator | null {
  if (!record.name || !record.url || !record.prerequisites || !record.category) {
    return null;
  }

  return {
    name: record.name,
    url: record.url,
    prerequisites: record.prerequisites,
    category: record.category,
    status: 'unknown',
  };
}

function isValidAccelerator(value: unknown): value is Accelerator {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Accelerator>;
  const validStatus = candidate.status === 'validating' || candidate.status === 'valid' || candidate.status === 'broken' || candidate.status === 'unknown';

  return (
    typeof candidate.name === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.prerequisites === 'string' &&
    typeof candidate.category === 'string' &&
    validStatus
  );
}

function readAcceleratorCache(): AcceleratorCachePayload | null {
  try {
    const raw = localStorage.getItem(ACCELERATOR_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AcceleratorCachePayload>;
    if (parsed.version !== ACCELERATOR_CACHE_VERSION || !Array.isArray(parsed.accelerators) || typeof parsed.lastRefreshIso !== 'string') {
      return null;
    }

    const accelerators = parsed.accelerators.filter((item): item is Accelerator => isValidAccelerator(item));
    if (accelerators.length === 0) {
      return null;
    }

    return {
      version: ACCELERATOR_CACHE_VERSION,
      accelerators,
      lastRefreshIso: parsed.lastRefreshIso,
    };
  } catch {
    return null;
  }
}

function writeAcceleratorCache(payload: AcceleratorCachePayload): void {
  try {
    localStorage.setItem(ACCELERATOR_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to persist accelerator cache:', error);
  }
}

export default function App() {
  const [accelerators, setAccelerators] = useState<Accelerator[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(300); // 5 minutes refresh cycle
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAccelerators = accelerators.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const liveAcceleratorCount = accelerators.filter((acc) => acc.status === 'valid').length;
  const brokenAcceleratorCount = accelerators.filter((acc) => acc.status === 'broken').length;
  const validationEngineLabel = 'Gemini API + deterministic fallback';

  const fetchFundingPrograms = useCallback(async (): Promise<Accelerator[]> => {
    const response = await fetch(`${API_BASE_URL}/api/funding-programs`);

    if (!response.ok) {
      throw new Error(`Funding program API error: ${response.status}`);
    }

    const payload = await response.json() as { programs?: FundingProgramRecord[] };
    const programs = Array.isArray(payload.programs) ? payload.programs : [];

    return programs
      .map((program) => normalizeProgram(program))
      .filter((program): program is Accelerator => program !== null);
  }, []);

  const mergeProgramsWithCache = useCallback((programs: Accelerator[], cached: Accelerator[]): Accelerator[] => {
    const cachedByName = new Map(cached.map((item) => [item.name, item]));

    return programs.map((program) => {
      const cachedMatch = cachedByName.get(program.name);
      if (!cachedMatch) {
        return program;
      }

      return {
        ...program,
        url: cachedMatch.url,
        prerequisites: cachedMatch.prerequisites,
        status: cachedMatch.status,
        lastChecked: cachedMatch.lastChecked,
      };
    });
  }, []);

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
        validationSource?: string;
      };

      const nextPrerequisites =
        typeof result.currentPrerequisites === 'string' && result.currentPrerequisites.trim().length > 0
          ? result.currentPrerequisites
          : acc.prerequisites;

      const nextStatus: Accelerator['status'] =
        result.isLive === true ? 'valid' : result.isLive === false ? 'broken' : 'unknown';
      
      return {
        ...acc,
        url: result.confirmedUrl || acc.url,
        prerequisites: nextPrerequisites,
        status: nextStatus,
        lastChecked: new Date().toLocaleTimeString()
      } as Accelerator;
    } catch (error) {
      console.error(`Error validating ${acc.name}:`, error);
      return { ...acc, status: 'unknown', lastChecked: new Date().toLocaleTimeString() } as Accelerator;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (accelerators.length === 0) {
      return;
    }

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
    const cached = readAcceleratorCache();
    if (cached) {
      setAccelerators(cached.accelerators);
      const parsedDate = new Date(cached.lastRefreshIso);
      if (!Number.isNaN(parsedDate.getTime())) {
        setLastRefresh(parsedDate);
        const elapsed = Math.floor((Date.now() - parsedDate.getTime()) / 1000);
        setCountdown(elapsed >= 300 ? 1 : Math.max(1, 300 - elapsed));
      }
    }

    const loadPrograms = async () => {
      try {
        const programs = await fetchFundingPrograms();
        if (cached) {
          setAccelerators(mergeProgramsWithCache(programs, cached.accelerators));
          return;
        }
        setAccelerators(programs);
      } catch (error) {
        console.error('Failed to load funding programs:', error);
      }
    };

    loadPrograms();
  }, [fetchFundingPrograms, mergeProgramsWithCache]);

  useEffect(() => {
    if (accelerators.length === 0) {
      return;
    }

    writeAcceleratorCache({
      version: ACCELERATOR_CACHE_VERSION,
      accelerators,
      lastRefreshIso: lastRefresh.toISOString(),
    });
  }, [accelerators, lastRefresh]);

  useEffect(() => {
    if (accelerators.length === 0) {
      return;
    }

    refreshAll();
  }, [accelerators.length]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-[88rem] mx-auto px-5 py-10 lg:px-6">
        {/* Header */}
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
              <Zap size={20} fill="currentColor" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase">Live Accelerator Pulse</span>
              </div>
              <h1 className="text-4xl md:text-6xl xl:text-7xl font-black tracking-[-0.06em] leading-[0.92] mb-3">
                FundingDash
              </h1>
              <p className="text-zinc-300 max-w-2xl text-base md:text-lg leading-relaxed">
                High-upside accelerator intelligence for venture-scale operators. Track live application links,
                preserve prerequisite context, and screen programs against a <span className="text-white font-semibold">{TARGET_RETURN_MULTIPLE}x+</span> return profile.
              </p>

              <div className="mt-5 relative max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search accelerators, categories, or venture profile..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(sanitizeSearchInput(e.target.value))}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-2xl py-3.5 pl-12 pr-6 text-sm md:text-[15px] focus:outline-none focus:border-orange-500/50 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch xl:items-end gap-3 xl:min-w-[24rem]">
              <div className="flex items-center justify-between gap-6 bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Next Auto-Refresh</div>
                  <div className="text-xl font-mono font-bold flex items-center gap-2">
                    <Clock size={17} className="text-orange-500" />
                    {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <button 
                  onClick={refreshAll}
                  disabled={isRefreshing}
                  className="group relative flex items-center gap-2 bg-white text-black px-5 py-3 rounded-xl font-bold hover:bg-orange-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                  {isRefreshing ? 'VALIDATING...' : 'REFRESH NOW'}
                </button>
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest xl:text-right">
                Last Pulse: {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-orange-300 mb-1">Target Return</div>
              <div className="text-2xl md:text-3xl font-black tracking-tight">{TARGET_RETURN_MULTIPLE}x+</div>
              <p className="text-xs text-orange-100/75 mt-1">Venture-scale upside target for screened opportunities.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/45 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Live Links</div>
              <div className="text-2xl md:text-3xl font-black tracking-tight">{liveAcceleratorCount}</div>
              <p className="text-xs text-zinc-400 mt-1">Programs currently validating as reachable.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/45 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Broken Flags</div>
              <div className="text-2xl md:text-3xl font-black tracking-tight">{brokenAcceleratorCount}</div>
              <p className="text-xs text-zinc-400 mt-1">Programs needing manual recheck or routing updates.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/45 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Validation Engine</div>
              <div className="text-sm md:text-base font-semibold leading-snug">{validationEngineLabel}</div>
              <p className="text-xs text-zinc-400 mt-1">Server-side model validation with safe fallback if the model path fails.</p>
            </div>
          </div>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAccelerators.map((acc, index) => (
              <motion.div
                key={acc.name}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group relative bg-zinc-900/40 backdrop-blur-sm border border-white/5 p-5 rounded-[1.5rem] hover:border-white/20 transition-all"
              >
                {/* Status Indicator */}
                <div className="absolute top-5 right-5">
                  {acc.status === 'validating' ? (
                    <RefreshCw size={18} className="text-blue-400 animate-spin" />
                  ) : acc.status === 'valid' ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : acc.status === 'broken' ? (
                    <AlertCircle size={18} className="text-red-400" />
                  ) : (
                    <Clock size={18} className="text-zinc-600" />
                  )}
                </div>

                <div className="mb-5 pr-8">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.18em] mb-2">{acc.category}</div>
                  <h3 className="text-2xl font-bold tracking-tight mb-3 leading-tight">{acc.name}</h3>
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

                <div className="space-y-3">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-orange-500/30 transition-colors">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">
                      <Info size={12} />
                      Application Info
                    </div>
                    <div className="grid gap-3">
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
                        <p className="text-[13px] text-zinc-300 leading-6 font-mono">
                          {acc.prerequisites}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-widest">
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
              Data validated through server-side checks with deterministic fallback handling.
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
