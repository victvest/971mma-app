import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { generatePersonaReply, type GeminiChatMessage } from '../_shared/gemini.ts';
import { resolveTargetUserId } from '../_shared/guardian.ts';
import { requireUser } from '../_shared/jwt.ts';
import { buildPersonaContext, buildPersonaSystemPrompt } from '../_shared/personaContext.ts';
import { buildPersonaFallbackReply } from '../_shared/personaFallback.ts';
import { sanitizePersonaActions } from '../_shared/personaKnowledge.ts';
import { serviceClient, userClient } from '../_shared/supabase.ts';

type PersonaChatRequest = {
  message?: string;
  history?: Array<{ role?: string; text?: string }>;
  targetUserId?: string;
};

const MAX_MESSAGE_LENGTH = 500;
const DAILY_LIMIT = parseInt(Deno.env.get('PERSONA_DAILY_LIMIT') ?? '40', 10);

function normalizeHistory(history: PersonaChatRequest['history']): GeminiChatMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-8)
    .map((entry) => {
      const role = entry.role === 'assistant' ? 'assistant' : 'user';
      const text = typeof entry.text === 'string' ? entry.text.trim() : '';
      return text ? { role, text: text.slice(0, 800) } : null;
    })
    .filter((entry): entry is GeminiChatMessage => Boolean(entry));
}

async function assertDailyQuota(userClientInstance: ReturnType<typeof userClient>, userId: string): Promise<void> {
  const { error } = await userClientInstance.rpc('persona_increment_chat_usage', {
    p_user: userId,
    p_daily_limit: DAILY_LIMIT,
  });

  if (!error) return;

  const message = typeof error.message === 'string' ? error.message : '';
  if (message.includes('RATE_LIMITED')) {
    throw new MbError('RATE_LIMITED', `Daily assistant limit reached (${DAILY_LIMIT} messages). Try again tomorrow.`);
  }

  throw new MbError('UPSTREAM_ERROR', 'Unable to verify assistant usage.');
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const authUser = await requireUser(req);
    if (authUser.role === 'coach' || authUser.role === 'admin' || authUser.role === 'gate') {
      throw new MbError('FORBIDDEN', 'Assistant is available to members only.');
    }

    const body = (await req.json().catch(() => ({}))) as PersonaChatRequest;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      throw new MbError('BAD_REQUEST', 'Message is required.');
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new MbError('BAD_REQUEST', `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
    }

    const svc = serviceClient();
    const authedClient = userClient(req);
    const memberUserId = await resolveTargetUserId(svc, authUser.userId, body.targetUserId);

    await assertDailyQuota(authedClient, memberUserId);

    const [context] = await Promise.all([buildPersonaContext(authedClient, memberUserId)]);
    const history = normalizeHistory(body.history);
    const contextJson = JSON.stringify(context);

    let reply: string;
    let actions: Array<{ label: string; route: string }> = [];

    try {
      const gemini = await generatePersonaReply(
        buildPersonaSystemPrompt(),
        contextJson,
        message,
        history,
      );
      reply = gemini.reply;
      actions = sanitizePersonaActions(gemini.actions);
    } catch (geminiError) {
      console.error('Persona Gemini fallback', geminiError);
      const fallback = buildPersonaFallbackReply(message, context);
      reply = fallback.reply;
      actions = fallback.actions;
    }

    return jsonResponse({
      reply,
      actions,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
