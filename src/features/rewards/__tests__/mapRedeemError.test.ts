import { mapRedeemErrorMessage } from '@/features/rewards/utils/mapRedeemError';

describe('mapRedeemErrorMessage', () => {
  it('maps known redeem_reward codes to member copy', () => {
    expect(mapRedeemErrorMessage('INSUFFICIENT_POINTS')).toMatch(/Not enough points/i);
    expect(mapRedeemErrorMessage('OUT_OF_STOCK')).toMatch(/sold out/i);
    expect(mapRedeemErrorMessage('REWARD_LOCKED')).toMatch(/tier/i);
  });

  it('never surfaces raw codes or empty strings', () => {
    expect(mapRedeemErrorMessage('SOME_UNKNOWN_CODE')).toMatch(/Could not redeem/i);
    expect(mapRedeemErrorMessage('PostgREST: relation does not exist')).toMatch(/Could not redeem/i);
    expect(mapRedeemErrorMessage(null)).toMatch(/Could not redeem/i);
  });
});
