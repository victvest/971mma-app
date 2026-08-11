import React, { memo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LiquidGlassSurface } from '@/shared/components/ui/LiquidGlassSurface';
import { AppBarBackButton, appBarButtonStyles } from '@/shared/components/ui/AppBarBackButton';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { getDefaultHomeRoute } from '@/shared/navigation/defaultHomeRoute';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { FeedSearchField } from './FeedSearchField';

type Props = {
  query: string;
  onChangeQuery: (value: string) => void;
  inputRef?: React.RefObject<TextInput | null>;
};

export const FeedSearchChrome = memo(function FeedSearchChrome({
  query,
  onChangeQuery,
  inputRef,
}: Props) {
  const { colors, inset, layout, appBarShadow } = useTheme();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const topInset = useAppTopInset();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(getDefaultHomeRoute(role));
  };

  return (
    <LiquidGlassSurface
      variant="chrome"
      borderRadius={0}
      showBorder={false}
      style={[
        styles.shell,
        appBarShadow(),
        {
          borderBottomColor: colors.border.subtle,
          height: layout.appHeaderHeight + topInset + inset.sm,
        },
      ]}
      contentStyle={[
        styles.row,
        {
          paddingTop: topInset,
          paddingBottom: inset.sm,
          paddingHorizontal: inset.md,
          gap: inset.sm,
        },
      ]}
    >
      <View
        style={[appBarButtonStyles.sideSlot, appBarButtonStyles.sideSlotStart, styles.backSlot]}
      >
        <AppBarBackButton onPress={handleBack} accessibilityLabel="Close search" />
      </View>
      <FeedSearchField ref={inputRef} value={query} onChangeText={onChangeQuery} />
    </LiquidGlassSurface>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  backSlot: {
    width: undefined,
  },
});
