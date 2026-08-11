import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

type Props = Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
};

export const FeedSearchField = forwardRef<TextInput, Props>(function FeedSearchField(
  { value, onChangeText, onClear, placeholder = 'Search posts or people', ...rest },
  ref,
) {
  const { colors, typography, inset, radius, layout } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.shell,
        {
          borderRadius: radius.input,
          backgroundColor: focused ? colors.surface.primary : colors.background.secondary,
          borderColor: focused ? colors.accent.default : colors.border.subtle,
          borderWidth: focused ? 1.5 : layout.borderWidth,
          paddingHorizontal: inset.md,
          minHeight: 48,
        },
      ]}
    >
      <Ionicons
        name="search"
        size={18}
        color={focused ? colors.accent.default : colors.text.tertiary}
        style={styles.leadingIcon}
      />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        style={[
          typography.textPresets.body,
          styles.input,
          { color: colors.text.primary, lineHeight: undefined },
        ]}
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
        </Pressable>
      ) : (
        <View
          style={styles.clearButton}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  leadingIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
