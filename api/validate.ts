import { GoogleGenAI } from '@google/genai';

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
    // Fallback to GET below.
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

export default async function handler(
  req: { method?: string; body?: { name?: unknown; url?: unknown; prerequisites?: unknown } },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void };
  },
) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

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

  const runDeterministicFallback = async () => {
    const isLive = await checkUrlReachability(normalizedUrl);

    return res.status(200).json({
      isLive,
      confirmedUrl: normalizedUrl,
      currentPrerequisites: prerequisites,
      validationSource: 'deterministic-fallback',
    });
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return runDeterministicFallback();
  }

  const ai = new GoogleGenAI({ apiKey });

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
      contents: `Validate accelerator application data from this trusted JSON payload:\n${promptPayload}\nVerify whether the URL is currently live and whether prerequisites are still accurate as of March 26, 2026.\nReturn strict JSON with fields: "isLive" (boolean), "confirmedUrl" (string), and "currentPrerequisites" (string).`,
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

    if (typeof parsed.isLive !== 'boolean') {
      return runDeterministicFallback();
    }

    return res.status(200).json({
      isLive: parsed.isLive,
      confirmedUrl: typeof parsed.confirmedUrl === 'string' ? parsed.confirmedUrl : normalizedUrl,
      currentPrerequisites:
        typeof parsed.currentPrerequisites === 'string' && parsed.currentPrerequisites.trim().length > 0
          ? parsed.currentPrerequisites
          : prerequisites,
      validationSource: 'model',
    });
  } catch (error) {
    console.error('[vercel] Validation failure:', error);
    return runDeterministicFallback();
  }
}
