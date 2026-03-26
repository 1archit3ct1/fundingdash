import { readFile } from 'node:fs/promises';

async function loadFundingPrograms() {
  const fileUrl = new URL('../datasets/funding_programs.json', import.meta.url);
  const fileText = await readFile(fileUrl, 'utf-8');
  const parsed = JSON.parse(fileText) as {
    programs?: Array<{ name?: string; url?: string; prerequisites?: string; category?: string }>;
  };

  const programs = Array.isArray(parsed.programs) ? parsed.programs : [];
  return programs.filter(
    (item) =>
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
    const programs = await loadFundingPrograms();
    return res.status(200).json({ programs });
  } catch (error) {
    console.error('[vercel] Failed to load funding programs:', error);
    return res.status(500).json({ error: 'Unable to load funding programs dataset.' });
  }
}
