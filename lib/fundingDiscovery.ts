import { GoogleGenAI } from '@google/genai';

export interface FundingProgram {
  name: string;
  url: string;
  prerequisites: string;
  category: string;
}

export interface FundingProgramsResult {
  programs: FundingProgram[];
  meta: {
    discoverySource: 'live-search' | 'dataset-only';
    discoveryRefreshedAt: string | null;
    refreshIntervalHours: number;
  };
}

const SAFE_TEXT_PATTERN = /^[a-zA-Z0-9\s.,'"()\-_/&:+#%!?;=]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_PREREQ_LENGTH = 1000;
const DEFAULT_REFRESH_INTERVAL_HOURS = 12;
const MAX_DISCOVERED_PROGRAMS = 8;
const VALID_CATEGORIES = new Set(['Global', 'Regional', 'Corporate', 'Niche']);

let cachedResult: (FundingProgramsResult & { expiresAt: number }) | null = null;

function isSafeText(value: string, maxLength: number): boolean {
  if (value.length === 0 || value.length > maxLength) {
    return false;
  }

  return SAFE_TEXT_PATTERN.test(value);
}

function normalizeCategory(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'global') {
    return 'Global';
  }

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

function normalizeProgram(input: Partial<FundingProgram>): FundingProgram | null {
  if (typeof input.name !== 'string' || typeof input.url !== 'string' || typeof input.prerequisites !== 'string') {
    return null;
  }

  const normalizedName = input.name.trim();
  const normalizedPrerequisites = input.prerequisites.trim();
  const normalizedUrl = normalizeUrl(input.url);

  if (!normalizedUrl || !isSafeText(normalizedName, MAX_NAME_LENGTH) || !isSafeText(normalizedPrerequisites, MAX_PREREQ_LENGTH)) {
    return null;
  }

  const category = typeof input.category === 'string' ? normalizeCategory(input.category) : 'Global';
  if (!VALID_CATEGORIES.has(category)) {
    return null;
  }

  return {
    name: normalizedName,
    url: normalizedUrl,
    prerequisites: normalizedPrerequisites,
    category,
  };
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

async function discoverFundingPrograms(basePrograms: FundingProgram[], apiKey: string): Promise<FundingProgram[]> {
  const ai = new GoogleGenAI({ apiKey });
  const baseNames = basePrograms.map((program) => program.name);
  const prompt = [
    'Find currently relevant startup accelerators, founder programs, and venture-backed startup programs with public application or program pages.',
    `Return at most ${MAX_DISCOVERED_PROGRAMS} programs that are NOT already in this exclusion list: ${baseNames.join(', ')}.`,
    'Prioritize active global and regional programs with recognizable brand presence and application information accessible on the public web.',
    'Return strict JSON in this shape: {"programs":[{"name":"string","url":"string","prerequisites":"string","category":"Global|Regional|Corporate|Niche"}]}',
    'Prerequisites must be concise and factual, using plain ASCII text only.',
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
    },
  });

  const parsed = JSON.parse(response.text || '{}') as { programs?: Array<Partial<FundingProgram>> };
  const candidates = Array.isArray(parsed.programs) ? parsed.programs : [];

  const existingNames = new Set(basePrograms.map((program) => program.name.toLowerCase()));
  const existingUrls = new Set(basePrograms.map((program) => program.url.toLowerCase()));
  const discovered: FundingProgram[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeProgram(candidate);
    if (!normalized) {
      continue;
    }

    const lowerName = normalized.name.toLowerCase();
    const lowerUrl = normalized.url.toLowerCase();
    if (existingNames.has(lowerName) || existingUrls.has(lowerUrl)) {
      continue;
    }

    const isReachable = await checkUrlReachability(normalized.url);
    if (!isReachable) {
      continue;
    }

    existingNames.add(lowerName);
    existingUrls.add(lowerUrl);
    discovered.push(normalized);

    if (discovered.length >= MAX_DISCOVERED_PROGRAMS) {
      break;
    }
  }

  return discovered;
}

export async function getFundingProgramsWithDiscovery(
  basePrograms: FundingProgram[],
  options: { apiKey?: string; refreshIntervalHours?: number } = {},
): Promise<FundingProgramsResult> {
  const refreshIntervalHours = Math.max(1, Math.floor(options.refreshIntervalHours || DEFAULT_REFRESH_INTERVAL_HOURS));
  const now = Date.now();

  if (cachedResult && cachedResult.expiresAt > now) {
    return {
      programs: cachedResult.programs,
      meta: cachedResult.meta,
    };
  }

  const fallbackResult: FundingProgramsResult = {
    programs: basePrograms,
    meta: {
      discoverySource: 'dataset-only',
      discoveryRefreshedAt: null,
      refreshIntervalHours,
    },
  };

  if (!options.apiKey) {
    cachedResult = {
      ...fallbackResult,
      expiresAt: now + refreshIntervalHours * 60 * 60 * 1000,
    };
    return fallbackResult;
  }

  try {
    const discoveredPrograms = await discoverFundingPrograms(basePrograms, options.apiKey);
    const refreshedAt = new Date().toISOString();
    const mergedPrograms = [...basePrograms, ...discoveredPrograms];
    const result: FundingProgramsResult = {
      programs: mergedPrograms,
      meta: {
        discoverySource: discoveredPrograms.length > 0 ? 'live-search' : 'dataset-only',
        discoveryRefreshedAt: refreshedAt,
        refreshIntervalHours,
      },
    };

    cachedResult = {
      ...result,
      expiresAt: now + refreshIntervalHours * 60 * 60 * 1000,
    };

    return result;
  } catch (error) {
    console.error('[discovery] Live funding program discovery failed:', error);

    cachedResult = {
      ...fallbackResult,
      expiresAt: now + refreshIntervalHours * 60 * 60 * 1000,
    };

    return fallbackResult;
  }
}