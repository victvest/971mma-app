import React from 'react';
import { Host, Button as ExpoButton } from '@expo/ui';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Button, type ButtonVariant } from './Button';

type NativeVariant = 'filled' | 'outlined' | 'text';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  compact?: boolean;
};

function mapVariant(variant: ButtonVariant): NativeVariant {
  switch (variant) {
    case 'outline':
      return 'outlined';
    case 'ghost':
      return 'text';
    default:
      return 'filled';
  }
}

export function NativeButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  style,
  full,
  compact,
}: Props) {
  const { colors, radius } = useTheme();
  const nativeVariant = mapVariant(variant);

  const buttonStyle = {
    width: full ? ('100%' as const) : undefined,
    backgroundColor: nativeVariant === 'filled' ? colors.accent.default : undefined,
    borderColor: nativeVariant === 'outlined' ? colors.border.default : undefined,
    borderRadius: radius.button,
    borderWidth: nativeVariant === 'outlined' ? 1.5 : 0,
    opacity: disabled ? 0.45 : 1,
    paddingHorizontal: compact ? 12 : undefined,
    paddingVertical: compact ? 8 : undefined,
  };

  return (
    <Host matchContents style={[{ alignSelf: full ? 'stretch' : 'flex-start' }, style]}>
      <ExpoButton
        label={label}
        onPress={onPress}
        disabled={disabled}
        variant={nativeVariant}
        style={buttonStyle}
      />
    </Host>
  );
}

type BrandedButtonProps = Props & {
  loading?: boolean;
  icon?: React.ComponentProps<typeof Button>['icon'];
  iconPosition?: React.ComponentProps<typeof Button>['iconPosition'];
  native?: boolean;
};

/**
 * Bridges Moti `Button` and `NativeButton`.
 * Use `native={true}` for coach/admin primary actions without loading or icons.
 * Loading and icons always use Moti `Button` for consistent feedback.
 */
export function BrandedButton({
  native = false,
  loading,
  icon,
  iconPosition,
  ...props
}: BrandedButtonProps) {
  if (native && !loading && !icon) {
    return <NativeButton {...props} />;
  }

  return (
    <Button
      {...props}
      loading={loading}
      icon={icon}
      iconPosition={iconPosition}
    />
  );
}
