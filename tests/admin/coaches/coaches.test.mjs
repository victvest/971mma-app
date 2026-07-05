/**
 * Admin panel — Coach directory management.
 *
 * Staff edit coach profiles (bio, rank, etc.) shown in the app's coaches tab.
 * We edit a real coach's bio and restore it.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Admin / coaches', () => {
  test('admin_update_coach edits a coach bio (and restores)', async (ctx) => {
    const coach = ctx.runSql(`select id::text as id, name, bio from public.coaches order by sort_order nulls last limit 1;`)[0];
    if (!coach?.id) return ctx.skip('no coaches seeded');
    const originalBio = coach.bio;
    const marker = `E2E bio ${Date.now()}`;
    try {
      await ctx.setRole('admin');
      // Pass p_name to disambiguate the overload set; keep the existing name.
      const res = await ctx.h.supabase.rpc('admin_update_coach', {
        p_coach_id: coach.id,
        p_name: coach.name,
        p_bio: marker,
      });
      assert(!res.error, `admin_update_coach failed: ${res.error?.message}`);
      assertEqual(
        ctx.runSql(`select bio from public.coaches where id = '${coach.id}'::uuid;`)[0].bio,
        marker,
        'coach bio must be updated',
      );
    } finally {
      const restore = originalBio === null ? 'null' : `'${String(originalBio).replace(/'/g, "''")}'`;
      ctx.runSql(`update public.coaches set bio = ${restore} where id = '${coach.id}'::uuid;`);
    }
  }, { role: 'admin' });
});
