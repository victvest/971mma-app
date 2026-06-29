import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardBottomInset } from '@/shared/hooks/useKeyboardBottomInset';
import { useTheme } from '@/shared/theme';

type CommunityChatLayoutProps = {
  list: React.ReactNode;
  composer: React.ReactNode;
  onKeyboardShow?: () => void;
};

export function CommunityChatLayout({ list, composer, onKeyboardShow }: CommunityChatLayoutProps) {
  const { colors, inset } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const keyboardInset = useKeyboardBottomInset();

  useEffect(() => {
    if (keyboardInset > 0) {
      onKeyboardShow?.();
    }
  }, [keyboardInset, onKeyboardShow]);

  const composerBottomPadding =
    keyboardInset > 0 ? keyboardInset + inset.xs : safeInsets.bottom + inset.sm;

  return (
    <View style={styles.root}>
      <View style={styles.list}>{list}</View>
      <View
        style={[
          styles.composerDock,
          {
            backgroundColor: colors.background.primary,
            borderTopColor: colors.border.subtle,
            paddingHorizontal: inset.md,
            paddingTop: inset.sm,
            paddingBottom: composerBottomPadding,
          },
        ]}
      >
        {composer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  composerDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
