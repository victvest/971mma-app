import React, { useEffect } from 'react';
import { Host, TextInput as ExpoTextInput, useNativeState } from '@expo/ui';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
import { TextField } from './TextField';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  containerStyle?: StyleProp<ViewStyle>;
  /** Fall back to themed TextField (e.g. when native state sync is undesirable). */
  fallback?: boolean;
};

export function NativeTextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  multiline,
  autoCapitalize = 'sentences',
  containerStyle,
  fallback = false,
}: Props) {
  const { colors, radius, inset } = useTheme();
  const nativeValue = useNativeState(value);

  useEffect(() => {
    if (nativeValue.value !== value) {
      nativeValue.value = value;
    }
  }, [nativeValue, value]);

  if (fallback) {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        hint={hint}
        error={error}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        containerStyle={containerStyle}
      />
    );
  }

  const borderColor = error
    ? colors.status.error
    : colors.border.default;

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <Host matchContents style={{ alignSelf: 'stretch' }}>
        <ExpoTextInput
          value={nativeValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          cursorColor={colors.accent.default}
          selectionColor={colors.accent.default}
          style={{
            height: multiline ? 96 : 54,
            borderRadius: radius.input,
            borderWidth: 1.5,
            borderColor,
            backgroundColor: colors.surface.secondary,
            paddingHorizontal: inset.md,
            paddingVertical: multiline ? inset.sm : 0,
          }}
          textStyle={{
            fontSize: 15,
            fontWeight: '500',
            color: colors.text.primary,
          }}
        />
      </Host>
      {(hint || error) && (
        <Text style={[styles.hint, { color: error ? colors.status.error : colors.text.tertiary }]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
});
