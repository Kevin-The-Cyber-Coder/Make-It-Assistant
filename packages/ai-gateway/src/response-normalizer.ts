export interface NormalizedResponse {
  text: string;
  codeBlocks: Array<{ language: string; code: string }>;
  words: number;
}

export function normalizeResponse(raw: string): NormalizedResponse {
  const text = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const codeBlocks = [...text.matchAll(/```([\w+-]*)\n([\s\S]*?)```/g)].map((match) => ({
    language: match[1] || 'text',
    code: match[2].trim(),
  }));

  return {
    text,
    codeBlocks,
    words: text.split(/\s+/).filter(Boolean).length,
  };
}

export function ensureNonEmpty(text: string, fallback = 'The provider returned an empty response.'): string {
  return text.trim().length > 0 ? text : fallback;
}
