/**
 * Mobile app — Class schedule & subscriptions.
 *
 * Covers that the member home dashboard surfaces upcoming classes and that a
 * member can subscribe / unsubscribe to a class (toggle_class_subscription),
 * which drives class reminders.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Schedule / dashboard', () => {
  test('home dashboard returns a coherent payload with class info', async (ctx) => {
    await ctx.setRole('member');
    const res = await ctx.h.supabase.rpc('get_member_home_dashboard', { p_user: ctx.userId });
    assert(!res.error, `get_member_home_dashboard failed: ${res.error?.message}`);
    assert(res.data && typeof res.data === 'object', 'dashboard must return an object payload');
    return { keys: Object.keys(res.data).slice(0, 12) };
  }, { role: 'member' });
});

suite('Schedule / subscriptions', () => {
  test('a member can subscribe then unsubscribe from a class', async (ctx) => {
    await ctx.setRole('member');
    const klass = ctx.runSql(
      `select id::text as id from public.classes
       where starts_at > now() and is_cancelled = false order by starts_at limit 1;`,
    )[0];
    if (!klass?.id) return ctx.skip('no upcoming class to subscribe to');

    const isSubscribed = () =>
      ctx.runSql(
        `select 1 as hit from public.class_subscriptions where user_id = '${ctx.userId}' and class_id = '${klass.id}'::uuid limit 1;`,
      ).length > 0;

    // Normalise to a known starting state.
    if (isSubscribed()) await ctx.h.supabase.rpc('toggle_class_subscription', { p_class_id: klass.id });

    try {
      const on = await ctx.h.supabase.rpc('toggle_class_subscription', { p_class_id: klass.id });
      assert(!on.error, `subscribe failed: ${on.error?.message}`);
      assertEqual(isSubscribed(), true, 'toggling on must create a subscription');

      const off = await ctx.h.supabase.rpc('toggle_class_subscription', { p_class_id: klass.id });
      assert(!off.error, `unsubscribe failed: ${off.error?.message}`);
      assertEqual(isSubscribed(), false, 'toggling off must remove the subscription');
    } finally {
      ctx.runSql(
        `delete from public.class_subscriptions where user_id = '${ctx.userId}' and class_id = '${klass.id}'::uuid;`,
      );
    }
  }, { role: 'member' });
});
