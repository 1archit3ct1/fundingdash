import { readFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';

interface FundingProgram {
  name: string;
  url: string;
  prerequisites: string;
  category: string;
}

const SAFE_TEXT_PATTERN = /^[a-zA-Z0-9\s.,'"()\-_/&:+#%!?;=]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_PREREQ_LENGTH = 1000;
const MAX_DISCOVERED_PROGRAMS = 8;

let cachedPrograms: {
  expiresAt: number;
  result: {
    programs: FundingProgram[];
    meta: {
      discoverySource: 'live-search' | 'dataset-only';
      discoveryRefreshedAt: string | null;
      refreshIntervalHours: number;
    };
  };
} | null = null;

function isSafeText(value: string, maxLength: number): boolean {
  if (value.length === 0 || value.length > maxLength) {
    return false;
  }

  return SAFE_TEXT_PATTERN.test(value);
}

function normalizeUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeCategory(value: string): FundingProgram['category'] {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'regional') {
    return 'Regional';
  }

  if (normalized === 'corporate') {
    return 'Corporate';
  }

  if (normalized === 'niche') {
    return 'Niche';
  }

  return 'Global';
}

async function checkUrlReachability(url: string): Promise<boolean> {
  try {
    const headResponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });

    if (headResponse.ok) {
      return true;
    }
  } catch {
    // Fall back to GET below.
  }

  try {
    const getResponse = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    return getResponse.ok;
  } catch {
    return false;
  }
}

function normalizeProgram(candidate: Partial<FundingProgram>): FundingProgram | null {
  if (typeof candidate.name !== 'string' || typeof candidate.url !== 'string' || typeof candidate.prerequisites !== 'string') {
    return null;
  }

  const normalizedName = candidate.name.trim();
  const normalizedPrerequisites = candidate.prerequisites.trim();
  const normalizedUrl = normalizeUrl(candidate.url);

  if (!normalizedUrl || !isSafeText(normalizedName, MAX_NAME_LENGTH) || !isSafeText(normalizedPrerequisites, MAX_PREREQ_LENGTH)) {
    return null;
  }

  return {
    name: normalizedName,
    url: normalizedUrl,
    prerequisites: normalizedPrerequisites,
    category: normalizeCategory(typeof candidate.category === 'string' ? candidate.category : 'Global'),
  };
}

async function discoverFundingPrograms(basePrograms: FundingProgram[], apiKey: string): Promise<FundingProgram[]> {
  const ai = new GoogleGenAI({ apiKey });
  const excludedNames = basePrograms.map((program) => program.name).join(', ');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      'Find active startup accelerators, founder programs, and venture-backed startup programs with public application or program pages.',
      `Return at most ${MAX_DISCOVERED_PROGRAMS} items not already in this exclusion list: ${excludedNames}.`,
      'Return strict JSON in this shape: {"programs":[{"name":"string","url":"string","prerequisites":"string","category":"Global|Regional|Corporate|Niche"}]}.',
      'Use concise ASCII prerequisites and only public web URLs.',
    ].join('\n'),
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
    },
  });

  const parsed = JSON.parse(response.text || '{}') as { programs?: Array<Partial<FundingProgram>> };
  const candidates = Array.isArray(parsed.programs) ? parsed.programs : [];
  const knownNames = new Set(basePrograms.map((program) => program.name.toLowerCase()));
  const knownUrls = new Set(basePrograms.map((program) => program.url.toLowerCase()));
  const discoveredPrograms: FundingProgram[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeProgram(candidate);
    if (!normalized) {
      continue;
    }

    const lowerName = normalized.name.toLowerCase();
    const lowerUrl = normalized.url.toLowerCase();
    if (knownNames.has(lowerName) || knownUrls.has(lowerUrl)) {
      continue;
    }

    const isReachable = await checkUrlReachability(normalized.url);
    if (!isReachable) {
      continue;
    }

    knownNames.add(lowerName);
    knownUrls.add(lowerUrl);
    discoveredPrograms.push(normalized);

    if (discoveredPrograms.length >= MAX_DISCOVERED_PROGRAMS) {
      break;
    }
  }

  return discoveredPrograms;
}

async function getProgramsWithDiscovery(basePrograms: FundingProgram[]) {
  const refreshIntervalHours = Math.max(1, Number(process.env.DISCOVERY_REFRESH_HOURS || 12));
  const now = Date.now();

  if (cachedPrograms && cachedPrograms.expiresAt > now) {
    return cachedPrograms.result;
  }

  const fallbackResult = {
    programs: basePrograms,
    meta: {
      discoverySource: 'dataset-only' as const,
      discoveryRefreshedAt: null,
      refreshIntervalHours,
    },
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    cachedPrograms = {
      expiresAt: now + refreshIntervalHours * 60 * 60 * 1000,
      result: fallbackResult,
    };
    return fallbackResult;
  }

  try {
    const discoveredPrograms = await discoverFundingPrograms(basePrograms, apiKey);
    const result = {
      programs: [...basePrograms, ...discoveredPrograms],
      meta: {
        discoverySource: discoveredPrograms.length > 0 ? ('live-search' as const) : ('dataset-only' as const),
        discoveryRefreshedAt: new Date().toISOString(),
        refreshIntervalHours,
      },
    };

    cachedPrograms = {
      expiresAt: now + refreshIntervalHours * 60 * 60 * 1000,
      result,
    };

    return result;
  } catch (error) {
    console.error('[vercel] Live funding discovery failed:', error);
    cachedPrograms = {
      expiresAt: now + refreshIntervalHours * 60 * 60 * 1000,
      result: fallbackResult,
    };
    return fallbackResult;
  }
}

async function loadFundingPrograms(): Promise<FundingProgram[]> {
  const fileUrl = new URL('../datasets/funding_programs.json', import.meta.url);
  const fileText = await readFile(fileUrl, 'utf-8');
  const parsed = JSON.parse(fileText) as {
    programs?: Array<{ name?: string; url?: string; prerequisites?: string; category?: string }>;
  };

  const programs = Array.isArray(parsed.programs) ? parsed.programs : [];
  return programs.filter(
    (item): item is FundingProgram =>
      typeof item.name === 'string' &&
      typeof item.url === 'string' &&
      typeof item.prerequisites === 'string' &&
      typeof item.category === 'string',
  );
}

export default async function handler(_req: { method?: string }, res: {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
}) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const basePrograms = await loadFundingPrograms();
    const result = await getProgramsWithDiscovery(basePrograms);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[vercel] Failed to load funding programs:', error);
    return res.status(500).json({ error: 'Unable to load funding programs dataset.' });
  }
}
