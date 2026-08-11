import {
  resolveNotificationAction,
  resolveNotificationActionFromPayload,
  resolvePushNotificationNavigation,
} from '../resolveNotificationAction';
import type { NotificationItem } from '@/types/domain';

function item(
  partial: Partial<NotificationItem> & Pick<NotificationItem, 'type'>,
): NotificationItem {
  return {
    id: 'n1',
    title: 'Test',
    body: '',
    createdAt: new Date().toISOString(),
    readAt: null,
    payload: {},
    ...partial,
  };
}

describe('resolveNotificationAction', () => {
  it('routes class reminders to class detail', () => {
    expect(
      resolveNotificationAction(
        item({ type: 'class_reminder', payload: { classId: 'abc' } }),
      )?.href,
    ).toBe('/classes/abc');
  });

  it('routes rewards and redemptions to rewards tab', () => {
    expect(resolveNotificationAction(item({ type: 'reward' }))?.href).toBe('/(tabs)/rewards');
    expect(resolveNotificationAction(item({ type: 'redemption' }))?.href).toBe('/(tabs)/rewards');
  });

  it('routes referral rewards to referrals', () => {
    expect(
      resolveNotificationAction(
        item({ type: 'reward', payload: { referral_id: 'ref-1' } }),
      )?.href,
    ).toBe('/referrals');
  });

  it('routes streak and belt notifications', () => {
    expect(resolveNotificationAction(item({ type: 'streak_warning' }))?.href).toBe(
      '/(tabs)/rewards',
    );
    expect(resolveNotificationAction(item({ type: 'belt' }))?.href).toBe('/(tabs)/belt-path');
  });

  it('routes feed likes to post when id present', () => {
    expect(
      resolveNotificationAction(
        item({ type: 'feed_like', payload: { post_id: 'p1' } }),
      )?.href,
    ).toBe('/feed/post/p1');
  });

  it('routes communities with channel id', () => {
    expect(
      resolveNotificationActionFromPayload('community', { channelId: 'ch1' })?.href,
    ).toBe('/communities/ch1');
  });

  it('push resolver matches inbox for reward type', () => {
    expect(resolvePushNotificationNavigation({ type: 'reward' })?.href).toBe('/(tabs)/rewards');
  });

  it('honors explicit url when type is unknown', () => {
    expect(
      resolveNotificationActionFromPayload('custom', { url: '/attendance' })?.href,
    ).toBe('/attendance');
  });
});
