import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  password?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInput, Props>(function TextField({
  label,
  hint,
  error,
  icon,
  password,
  style,
  containerStyle,
  ...rest
}, ref) {
  const { colors, radius, inset } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!password);

  const borderColor = error
    ? colors.status.error
    : focused
      ? colors.accent.default
      : colors.border.default;

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>

      <View
        style={[
          styles.field,
          {
            borderRadius: radius.input,
            borderColor,
            backgroundColor: focused ? colors.surface.primary : colors.surface.secondary,
            paddingHorizontal: inset.md,
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.accent.default : colors.text.tertiary}
            style={styles.iconLeft}
          />
        )}
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.text.primary }, style]}
          placeholderTextColor={colors.text.tertiary}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {password && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={colors.text.tertiary}
            />
          </Pressable>
        )}
      </View>

      {(hint || error) && (
        <Text
          style={[
            styles.hint,
            { color: error ? colors.status.error : colors.text.tertiary },
          ]}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderWidth: 1.5,
  },
  iconLeft: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
});
