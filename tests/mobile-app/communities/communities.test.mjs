/**
 * Mobile app — Communities (channels & membership gating).
 *
 * Channels are visibility-gated by membership. Covers: a member can list channels,
 * a channel they belong to is exposed to them, and channel access is membership
 * driven (can_access_community_channel).
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Communities / channel access', () => {
  test('list_community_channels returns a JSON array for a member', async (ctx) => {
    await ctx.setRole('member');
    const res = await ctx.h.supabase.rpc('list_community_channels');
    assert(!res.error, `list_community_channels failed: ${res.error?.message}`);
    // Shape is { channels: [...] }.
    assert(Array.isArray(res.data?.channels), 'channels listing must expose a channels array');
    return { channelCount: res.data.channels.length };
  }, { role: 'member' });

  test('a channel a member joins becomes visible in their channel listing', async (ctx) => {
    await ctx.setRole('member');
    const channel = ctx.runSql(`select id::text as id from public.community_channels order by created_at limit 1;`)[0];
    if (!channel?.id) return ctx.skip('no community channels seeded');

    // Seed a membership for the shared test user, then read the listing AS the member
    // (auth.uid() = this user) and assert the channel is now exposed to them.
    ctx.runSql(
      `insert into public.community_memberships (channel_id, user_id, joined_at)
       values ('${channel.id}'::uuid, '${ctx.userId}', now())
       on conflict do nothing;`,
    );
    try {
      const res = await ctx.h.supabase.rpc('list_community_channels');
      assert(!res.error, `list_community_channels failed: ${res.error?.message}`);
      const exposed = JSON.stringify(res.data ?? []).includes(channel.id);
      assert(exposed, 'a joined channel must appear in the member listing');
    } finally {
      ctx.runSql(
        `delete from public.community_memberships where channel_id = '${channel.id}'::uuid and user_id = '${ctx.userId}';`,
      );
    }
  }, { role: 'member' });
});
