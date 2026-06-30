import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireInternalSecret } from '../_shared/internalAuth.ts';
import { sendPushToUsers } from '../_shared/push.ts';
import { serviceClient } from '../_shared/supabase.ts';

const GYM_TIME_ZONE = 'Asia/Dubai';

type GraceMemberRow = {
  user_id: string;
  current_streak: number;
};

function gymTodayIsoDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
    requireInternalSecret(req);
    const svc = serviceClient();
    const gymDate = gymTodayIsoDate();

    const { data, error } = await svc.rpc('list_streak_grace_members', {
      p_gym_date: gymDate,
    });

    if (error) {
      throw new MbError('UPSTREAM_ERROR', `Unable to load grace streaks: ${error.message}`);
    }

    const rows = (data ?? []) as GraceMemberRow[];
    if (rows.length === 0) {
      return jsonResponse({ ok: true, gymDate, sentCount: 0, memberCount: 0 });
    }

    const userIds = rows.map((row) => row.user_id);
    const streakByUser = new Map(rows.map((row) => [row.user_id, row.current_streak]));

    await sendPushToUsers(svc, {
      userIds,
      title: 'Keep your streak alive',
      body: 'You are in your grace window. Train today to protect your attendance streak.',
      data: {
        type: 'streak_warning',
        url: '/(tabs)/rewards',
        gymDate,
      },
    });

    const { error: markError } = await svc.rpc('mark_streak_warnings_sent', {
      p_user_ids: userIds,
      p_gym_date: gymDate,
    });

    if (markError) {
      throw new MbError('UPSTREAM_ERROR', `Unable to mark streak warnings: ${markError.message}`);
    }

    return jsonResponse({
      ok: true,
      gymDate,
      memberCount: userIds.length,
      sentCount: userIds.length,
      sampleStreak: streakByUser.get(userIds[0] ?? '') ?? 0,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
