import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fundingProgramsPath = path.resolve(__dirname, '..', 'datasets', 'funding_programs.json');

const defaultCorsOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
const corsAllowlist = (process.env.CORS_ALLOWLIST || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set(corsAllowlist.length > 0 ? corsAllowlist : defaultCorsOrigins);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS policy blocked this origin.'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};

const validateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.VALIDATION_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many validation requests. Please retry later.' },
});

app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use('/api', cors(corsOptions));
app.use(express.json({ limit: '32kb' }));

const port = Number(process.env.SERVER_PORT || 8787);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[server] GEMINI_API_KEY is missing. Validation route will fail until it is set.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const MAX_NAME_LENGTH = 120;
const MAX_PREREQ_LENGTH = 1000;
const SAFE_TEXT_PATTERN = /^[a-zA-Z0-9\s.,'"()\-_/&:+#%!?;=]+$/;

function isSafeText(value: string, maxLength: number): boolean {
  if (value.length === 0 || value.length > maxLength) {
    return false;
  }

  return SAFE_TEXT_PATTERN.test(value);
}

function normalizeAndValidateUrl(value: string): string | null {
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

async function loadFundingPrograms(): Promise<Array<{ name: string; url: string; prerequisites: string; category: string }>> {
  const fileText = await readFile(fundingProgramsPath, 'utf-8');
  const parsed = JSON.parse(fileText) as {
    programs?: Array<{ name?: string; url?: string; prerequisites?: string; category?: string }>;
  };

  const programs = Array.isArray(parsed.programs) ? parsed.programs : [];

  return programs
    .filter((item) => typeof item.name === 'string' && typeof item.url === 'string' && typeof item.prerequisites === 'string' && typeof item.category === 'string')
    .map((item) => ({
      name: item.name as string,
      url: item.url as string,
      prerequisites: item.prerequisites as string,
      category: item.category as string,
    }));
}

app.get('/api/funding-programs', async (_req: Request, res: Response) => {
  try {
    const programs = await loadFundingPrograms();
    return res.json({ programs });
  } catch (error) {
    console.error('[server] Failed to load funding programs:', error);
    return res.status(500).json({ error: 'Unable to load funding programs dataset.' });
  }
});

app.post('/api/validate', validateRateLimit, async (req: Request, res: Response) => {
  const { name, url, prerequisites } = req.body ?? {};

  if (typeof name !== 'string' || typeof url !== 'string' || typeof prerequisites !== 'string') {
    return res.status(400).json({ error: 'Invalid payload. Expected name, url, and prerequisites as strings.' });
  }

  if (!isSafeText(name, MAX_NAME_LENGTH)) {
    return res.status(400).json({ error: 'Malformed input: name failed allowed-character or length policy.' });
  }

  if (!isSafeText(prerequisites, MAX_PREREQ_LENGTH)) {
    return res.status(400).json({ error: 'Malformed input: prerequisites failed allowed-character or length policy.' });
  }

  const normalizedUrl = normalizeAndValidateUrl(url);
  if (!normalizedUrl) {
    return res.status(400).json({ error: 'Malformed input: url must be a valid http/https URL.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set.' });
  }

  try {
    const promptPayload = JSON.stringify(
      {
        name,
        url: normalizedUrl,
        prerequisites,
      },
      null,
      2,
    );

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Validate accelerator application data from this trusted JSON payload:
${promptPayload}
Verify whether the URL is currently live and whether prerequisites are still accurate as of March 26, 2026.
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
      confirmedUrl: typeof parsed.confirmedUrl === 'string' ? parsed.confirmedUrl : normalizedUrl,
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
