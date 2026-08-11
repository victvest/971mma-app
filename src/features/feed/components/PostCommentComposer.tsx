import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardBottomInset } from '@/shared/hooks/useKeyboardBottomInset';
import { useTheme } from '@/shared/theme';

const MAX_COMMENT_CHARS = 500;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  isSending?: boolean;
  onFocus?: () => void;
  onMeasuredHeight?: (height: number) => void;
};

/** Inline composer field — parent handles keyboard offset and absolute positioning. */
export function PostCommentComposer({
  value,
  onChangeText,
  onSend,
  canSend,
  isSending = false,
  onFocus,
  onMeasuredHeight,
}: Props) {
  const { colors, typography, inset, radius, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const keyboardInset = useKeyboardBottomInset();
  const shellBottomPadding = keyboardInset > 0 ? inset.sm : safeInsets.bottom + inset.sm;

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onMeasuredHeight?.(event.nativeEvent.layout.height);
    },
    [onMeasuredHeight],
  );

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.shell,
        {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.border.subtle,
          paddingBottom: shellBottomPadding,
          paddingHorizontal: inset.lg,
          paddingTop: inset.sm,
        },
      ]}
    >
      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.surface.primary,
            borderColor: colors.border.subtle,
            borderRadius: radius.card,
            borderWidth: layout.borderWidth,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder="Add a comment..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={MAX_COMMENT_CHARS}
          editable={!isSending}
          style={[typography.textPresets.body, styles.input, { color: colors.text.primary }]}
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend || isSending}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          style={[
            styles.sendButton,
            {
              borderRadius: radius.pill,
              backgroundColor: canSend ? colors.accent.default : colors.fill.secondary,
            },
          ]}
        >
          <Ionicons
            name="send"
            size={17}
            color={canSend ? colors.accent.onAccent : colors.text.tertiary}
          />
        </Pressable>
      </View>
      {value.length > MAX_COMMENT_CHARS * 0.85 ? (
        <Text
          style={[typography.textPresets.caption, styles.counter, { color: colors.text.tertiary }]}
        >
          {MAX_COMMENT_CHARS - value.length} left
        </Text>
      ) : null}
    </View>
  );
}

export { MAX_COMMENT_CHARS };

const styles = StyleSheet.create({
  shell: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    maxHeight: 112,
    minHeight: 36,
    padding: 0,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginLeft: 8,
    width: 36,
  },
  counter: {
    marginTop: 4,
    textAlign: 'right',
  },
});
