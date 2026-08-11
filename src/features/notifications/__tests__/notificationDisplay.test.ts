import {
  humanizeNotificationType,
  notificationDisplayBody,
  notificationDisplayTitle,
} from '../utils/notificationDisplay';

describe('notificationDisplay', () => {
  it('prefers payload title over type', () => {
    expect(notificationDisplayTitle('reward', { title: 'You earned 50 pts' })).toBe(
      'You earned 50 pts',
    );
  });

  it('humanizes raw type codes when title missing', () => {
    expect(notificationDisplayTitle('class_reminder', {})).toBe('Class reminder');
    expect(humanizeNotificationType('unknown_custom_type')).toBe('Unknown Custom Type');
  });

  it('reads body or message from payload', () => {
    expect(notificationDisplayBody({ body: 'Hello' })).toBe('Hello');
    expect(notificationDisplayBody({ message: 'Alt' })).toBe('Alt');
    expect(notificationDisplayBody({})).toBeNull();
  });
});
