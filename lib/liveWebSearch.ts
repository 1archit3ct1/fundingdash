import { GoogleGenAI } from '@google/genai';

export interface LiveWebSearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceDomain: string;
}

export interface LiveWebSearchResponse {
  results: LiveWebSearchResult[];
  searchSummary: string;
}

export class LiveWebSearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveWebSearchInputError';
  }
}

const QUERY_MAX_LENGTH = 140;
const MAX_RESULTS_LIMIT = 8;
const SAFE_QUERY_PATTERN = /^[a-zA-Z0-9\s.,'"()\-_/&:+#%!?;=]+$/;

function sanitizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
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

function normalizeSnippet(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 360);
}

function normalizeResult(candidate: Partial<LiveWebSearchResult>): LiveWebSearchResult | null {
  if (typeof candidate.title !== 'string' || typeof candidate.url !== 'string' || typeof candidate.snippet !== 'string') {
    return null;
  }

  const title = candidate.title.trim().slice(0, 160);
  const url = normalizeUrl(candidate.url);
  const snippet = normalizeSnippet(candidate.snippet);

  if (!title || !url || !snippet) {
    return null;
  }

  return {
    title,
    url,
    snippet,
    sourceDomain: new URL(url).hostname,
  };
}

export async function runLiveWebSearch(options: {
  apiKey: string;
  query: string;
  maxResults?: number;
}): Promise<LiveWebSearchResponse> {
  const query = sanitizeQuery(options.query);

  if (!query || query.length > QUERY_MAX_LENGTH || !SAFE_QUERY_PATTERN.test(query)) {
    throw new LiveWebSearchInputError('Malformed input: query failed allowed-character or length policy.');
  }

  const maxResults = Math.max(1, Math.min(MAX_RESULTS_LIMIT, Math.floor(options.maxResults || 5)));
  const ai = new GoogleGenAI({ apiKey: options.apiKey });

  const prompt = [
    'Run a live web search and return concise, factual references.',
    `Query: ${query}`,
    `Return at most ${maxResults} results.`,
    'Return strict JSON only in this shape: {"searchSummary":"string","results":[{"title":"string","url":"string","snippet":"string"}]}.',
    'Use only publicly accessible pages and include no markdown or extra keys.',
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
    },
  });

  const parsed = JSON.parse(response.text || '{}') as {
    searchSummary?: unknown;
    results?: Array<Partial<LiveWebSearchResult>>;
  };

  const normalizedResults = Array.isArray(parsed.results)
    ? parsed.results
        .map((item) => normalizeResult(item))
        .filter((item): item is LiveWebSearchResult => item !== null)
        .slice(0, maxResults)
    : [];

  return {
    searchSummary: typeof parsed.searchSummary === 'string' ? parsed.searchSummary.trim().slice(0, 300) : '',
    results: normalizedResults,
  };
}