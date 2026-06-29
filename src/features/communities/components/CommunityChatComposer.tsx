import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type CommunityChatComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  sending?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  readOnlyHint?: string;
  showAttach?: boolean;
  onAttach?: () => void;
};

export function CommunityChatComposer({
  value,
  onChangeText,
  onSend,
  placeholder = 'Message…',
  sending = false,
  disabled = false,
  readOnly = false,
  readOnlyHint = 'Tap a message to reply in the thread.',
  showAttach = false,
  onAttach,
}: CommunityChatComposerProps) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const canSend = !readOnly && !disabled && !sending && value.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    triggerSelectionHaptic();
    onSend();
  }, [canSend, onSend]);

  if (readOnly) {
    return (
      <View style={[styles.readOnlyBar, { paddingVertical: inset.xs }]}>
        <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary, textAlign: 'center' }]}>
          {readOnlyHint}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colors.fill.secondary,
          borderRadius: radius.pill,
          gap: gap.sm,
          paddingHorizontal: inset.sm,
          paddingVertical: 6,
        },
      ]}
    >
      {showAttach ? (
        <Pressable
          onPress={onAttach}
          disabled={!onAttach || disabled}
          accessibilityRole="button"
          accessibilityLabel="Add attachment"
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.fill.secondary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.text.secondary} />
        </Pressable>
      ) : null}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        editable={!disabled && !sending}
        multiline
        maxLength={2000}
        style={[
          styles.input,
          typography.textPresets.body,
          {
            color: colors.text.primary,
            maxHeight: 120,
          },
        ]}
      />

      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={({ pressed }) => [
          styles.sendButton,
          {
            backgroundColor: canSend ? colors.accent.default : colors.fill.secondary,
            opacity: pressed && canSend ? 0.88 : 1,
          },
        ]}
      >
        {sending ? (
          <ActivityIndicator size="small" color={colors.text.inverse} />
        ) : (
          <Ionicons
            name="arrow-up"
            size={18}
            color={canSend ? colors.accent.onAccent : colors.text.tertiary}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    width: '100%',
  },
  readOnlyBar: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  input: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
