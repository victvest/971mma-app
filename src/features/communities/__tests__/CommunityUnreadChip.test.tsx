import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CommunityUnreadChip } from '@/features/communities/components/CommunityUnreadChip';

jest.mock('@/shared/theme', () => ({
  useTheme: () => ({
    colors: {
      status: { error: '#E11900' },
      text: { inverse: '#FFFFFF' },
    },
    typography: {
      textPresets: {
        caption: { fontSize: 11 },
      },
    },
  }),
}));

describe('CommunityUnreadChip', () => {
  it('renders nothing when count is zero', async () => {
    const view = await render(<CommunityUnreadChip count={0} />);
    expect(view.toJSON()).toBeNull();
  });

  it('renders red unread count', async () => {
    await render(<CommunityUnreadChip count={4} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByLabelText('4 unread messages')).toBeTruthy();
  });

  it('caps display at 99+', async () => {
    await render(<CommunityUnreadChip count={120} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });
});
