import { MbError } from './errors.ts';

export type GeminiChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type GeminiPersonaResponse = {
  reply: string;
  actions?: Array<{ label: string; route: string }>;
};

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
const GEMINI_TIMEOUT_MS = 25_000;

function requireGeminiKey(): string {
  const key = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!key) {
    throw new MbError('UPSTREAM_ERROR', 'Assistant is temporarily unavailable.', 503);
  }
  return key;
}

export async function generatePersonaReply(
  systemPrompt: string,
  contextJson: string,
  message: string,
  history: GeminiChatMessage[],
): Promise<GeminiPersonaResponse> {
  const apiKey = requireGeminiKey();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const contents = [
    ...history.slice(-8).map((entry) => ({
      role: entry.role === 'user' ? 'user' : 'model',
      parts: [{ text: entry.text }],
    })),
    {
      role: 'user',
      parts: [{ text: `Member question:\n${message}\n\nAcademy context (JSON):\n${contextJson}` }],
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 640,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              reply: { type: 'string' },
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    route: { type: 'string' },
                  },
                  required: ['label', 'route'],
                },
              },
            },
            required: ['reply'],
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Gemini API error', response.status, detail.slice(0, 400));
      throw new MbError('UPSTREAM_ERROR', 'Assistant is temporarily unavailable.', 502);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new MbError('UPSTREAM_ERROR', 'Assistant returned an empty response.', 502);
    }

    const parsed = JSON.parse(text) as GeminiPersonaResponse;
    if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
      throw new MbError('UPSTREAM_ERROR', 'Assistant returned an invalid response.', 502);
    }

    return {
      reply: parsed.reply.trim(),
      actions: parsed.actions,
    };
  } catch (error) {
    if (error instanceof MbError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new MbError('UPSTREAM_ERROR', 'Assistant timed out. Please try again.', 504);
    }
    console.error('Gemini request failed', error);
    throw new MbError('UPSTREAM_ERROR', 'Assistant is temporarily unavailable.', 502);
  } finally {
    clearTimeout(timeout);
  }
}
