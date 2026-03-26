import 'dotenv/config';
import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();

app.use(express.json({ limit: '32kb' }));

const port = Number(process.env.SERVER_PORT || 8787);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[server] GEMINI_API_KEY is missing. Validation route will fail until it is set.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

app.post('/api/validate', async (req: Request, res: Response) => {
  const { name, url, prerequisites } = req.body ?? {};

  if (typeof name !== 'string' || typeof url !== 'string' || typeof prerequisites !== 'string') {
    return res.status(400).json({ error: 'Invalid payload. Expected name, url, and prerequisites as strings.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set.' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Verify if the application link for ${name} is still live and accurate as of March 26, 2026.
Current URL: ${url}
Also, confirm the current prerequisites for applying.
Return strict JSON with fields: "isLive" (boolean), "confirmedUrl" (string), and "currentPrerequisites" (string).`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}') as {
      isLive?: boolean;
      confirmedUrl?: string;
      currentPrerequisites?: string;
    };

    return res.json({
      isLive: Boolean(parsed.isLive),
      confirmedUrl: typeof parsed.confirmedUrl === 'string' ? parsed.confirmedUrl : url,
      currentPrerequisites:
        typeof parsed.currentPrerequisites === 'string' ? parsed.currentPrerequisites : prerequisites,
    });
  } catch (error) {
    console.error('[server] Validation failure:', error);
    return res.status(502).json({ error: 'Validation provider request failed.' });
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`[server] FundingDash API listening on http://localhost:${port}`);
});
