import { LiveWebSearchInputError, runLiveWebSearch } from '../lib/liveWebSearch.js';

export default async function handler(
  req: { method?: string; body?: { query?: unknown; maxResults?: unknown } },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void };
  },
) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { query, maxResults } = req.body ?? {};
  if (typeof query !== 'string') {
    return res.status(400).json({ error: 'Invalid payload. Expected query as string.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Live web search is unavailable: GEMINI_API_KEY is not configured.' });
  }

  try {
    const result = await runLiveWebSearch({
      apiKey,
      query,
      maxResults: typeof maxResults === 'number' ? maxResults : undefined,
    });

    return res.status(200).json({
      ...result,
      source: 'gemini-google-search',
    });
  } catch (error) {
    if (error instanceof LiveWebSearchInputError) {
      return res.status(400).json({ error: error.message });
    }

    console.error('[vercel] Live web search failure:', error);
    return res.status(502).json({ error: 'Live web search provider request failed.' });
  }
}