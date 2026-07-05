/**
 * Admin panel — Gate exit PIN.
 *
 * The gate tablet requires a staff PIN to exit kiosk mode. Admins set/rotate it.
 * We set a known PIN, prove validation accepts the right PIN and rejects wrong
 * ones, then restore the original hash.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Admin / gate exit PIN', () => {
  test('admin sets an exit PIN; validation accepts it and rejects wrong PINs', async (ctx) => {
    await ctx.setRole('admin');
    const original = ctx.runSql(`select exit_pin_hash from public.gate_settings where id = 1;`)[0]?.exit_pin_hash ?? null;
    const pin = '4729';
    try {
      const set = await ctx.h.supabase.rpc('admin_update_gate_exit_pin', { p_pin: pin });
      assert(!set.error, `admin_update_gate_exit_pin failed: ${set.error?.message}`);

      const ok = await ctx.h.supabase.rpc('gate_validate_exit_pin', { p_pin: pin });
      assert(!ok.error, `gate_validate_exit_pin failed: ${ok.error?.message}`);
      assertEqual(ok.data, true, 'correct PIN must validate');

      const bad = await ctx.h.supabase.rpc('gate_validate_exit_pin', { p_pin: '0000' });
      assertEqual(bad.data, false, 'a wrong PIN must be rejected');

      const status = await ctx.h.supabase.rpc('admin_get_gate_settings');
      assert(!status.error, `admin_get_gate_settings failed: ${status.error?.message}`);
    } finally {
      const restore = original === null ? 'null' : `'${String(original).replace(/'/g, "''")}'`;
      ctx.runSql(`update public.gate_settings set exit_pin_hash = ${restore} where id = 1;`);
    }
  }, { role: 'admin' });
});
