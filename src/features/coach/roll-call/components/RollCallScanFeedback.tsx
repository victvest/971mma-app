import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandedButton } from '@/shared/components/ui';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  code: string;
  message: string;
  onTryAgain: () => void;
};

type ErrorSpec = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
};

const ERROR_SPECS: Record<string, ErrorSpec> = {
  INVALID_QR: {
    icon: 'qr-code-outline',
    title: 'Invalid QR code',
  },
  UNKNOWN: {
    icon: 'help-circle-outline',
    title: 'Unknown member',
  },
  UNKNOWN_MEMBER: {
    icon: 'person-outline',
    title: 'Could not find this member',
  },
  NOT_LINKED: {
    icon: 'link-outline',
    title: 'Account not linked',
  },
  NOT_FOUND: {
    icon: 'person-outline',
    title: 'Could not find this member',
  },
  SAVE_FAILED: {
    icon: 'cloud-offline-outline',
    title: 'Could not save',
  },
};

function resolveErrorSpec(code: string): ErrorSpec {
  return (
    ERROR_SPECS[code] ?? {
      icon: 'alert-circle-outline',
      title: 'Could not read QR',
    }
  );
}

export const RollCallScanFeedback = memo(function RollCallScanFeedback({
  code,
  message,
  onTryAgain,
}: Props) {
  const { colors, typography, inset, gap } = useTheme();
  const spec = useMemo(() => resolveErrorSpec(code), [code]);

  const handleTryAgain = () => {
    triggerLightImpact();
    onTryAgain();
  };

  return (
    <View style={[styles.wrap, { paddingHorizontal: inset.xl, gap: gap.md }]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.fill.secondary,
            borderRadius: 999,
          },
        ]}
      >
        <Ionicons name={spec.icon} size={32} color={colors.text.secondary} />
      </View>

      <Text style={[typography.textPresets.subtitle, styles.title, { color: colors.text.primary }]}>
        {spec.title}
      </Text>
      <Text style={[typography.textPresets.body, styles.message, { color: colors.text.secondary }]}>
        {message}
      </Text>

      <BrandedButton label="Try again" variant="outline" full onPress={handleTryAgain} style={styles.action} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  iconWrap: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    lineHeight: 22,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
