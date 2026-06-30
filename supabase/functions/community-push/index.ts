import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { sendPushToUsers } from '../_shared/push.ts';
import { serviceClient } from '../_shared/supabase.ts';

type CommunityPushRequest = {
  postId?: unknown;
  replyId?: unknown;
};

function readId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'BAD_REQUEST', message: 'POST required.' } },
      { status: 405 },
    );
  }

  try {
    const caller = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as CommunityPushRequest;
    const postId = readId(body.postId);
    const replyId = readId(body.replyId);

    if (!postId && !replyId) {
      throw new MbError('BAD_REQUEST', 'postId or replyId is required.');
    }

    const svc = serviceClient();

    if (postId) {
      const { data: postRow, error: postError } = await svc
        .from('community_posts')
        .select('id, author_id, channel_id')
        .eq('id', postId)
        .maybeSingle();

      if (postError) {
        throw new MbError('UPSTREAM_ERROR', postError.message);
      }

      if (!postRow) {
        throw new MbError('NOT_FOUND', 'Post not found.');
      }

      const { data: channelRow, error: channelError } = await svc
        .from('community_channels')
        .select('coach_id, coaches(user_id)')
        .eq('id', postRow.channel_id)
        .maybeSingle();

      if (channelError) {
        throw new MbError('UPSTREAM_ERROR', channelError.message);
      }

      const coachRecord = channelRow?.coaches as
        | { user_id?: string | null }
        | Array<{ user_id?: string | null }>
        | null;
      const coachUserId = Array.isArray(coachRecord) ? coachRecord[0]?.user_id : coachRecord?.user_id;

      const isAuthor = postRow.author_id === caller.userId;
      const isCoachOwner = coachUserId === caller.userId;
      const isAdmin = caller.role === 'admin';

      if (!isAuthor && !isCoachOwner && !isAdmin) {
        throw new MbError('FORBIDDEN', 'Only the channel coach can fan out announcement push.');
      }
    } else if (replyId) {
      const { data: replyRow, error: replyError } = await svc
        .from('community_replies')
        .select('id, user_id')
        .eq('id', replyId)
        .maybeSingle();

      if (replyError) {
        throw new MbError('UPSTREAM_ERROR', replyError.message);
      }

      if (!replyRow) {
        throw new MbError('NOT_FOUND', 'Reply not found.');
      }

      const isAuthor = replyRow.user_id === caller.userId;
      const isAdmin = caller.role === 'admin';

      if (!isAuthor && !isAdmin) {
        throw new MbError('FORBIDDEN', 'Only the reply author can fan out reply push.');
      }
    }

    const { data: recipients, error: recipientError } = await svc.rpc('get_community_push_recipients', {
      p_post_id: postId,
      p_reply_id: replyId,
      p_exclude_user_id: caller.userId,
    });

    if (recipientError) {
      throw new MbError('UPSTREAM_ERROR', recipientError.message);
    }

    const payload = (recipients ?? {}) as Record<string, unknown>;
    const userIds = Array.isArray(payload.userIds)
      ? payload.userIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      : [];

    if (userIds.length === 0) {
      return jsonResponse({ ok: true, userCount: 0, tokenCount: 0 });
    }

    const title = typeof payload.title === 'string' ? payload.title : '971 MMA';
    const messageBody = typeof payload.body === 'string' ? payload.body : '';
    const channelId = typeof payload.channelId === 'string' ? payload.channelId : null;
    const resolvedPostId = typeof payload.postId === 'string' ? payload.postId : postId;
    const url = typeof payload.url === 'string' ? payload.url : null;

    const result = await sendPushToUsers(svc, {
      userIds,
      title,
      body: messageBody,
      insertInApp: false,
      data: {
        type: 'community',
        channelId,
        postId: resolvedPostId,
        replyId,
        url,
      },
    });

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse(error);
  }
});
