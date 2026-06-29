import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_CHROME_ELEVATION } from '@/features/home/components/navigation/floatingChromeElevation';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { PERSONA_ASSISTANT_NAME } from '../constants';
import { PERSONA_SUGGESTIONS } from '../hooks/usePersonaChat';
import type { PersonaMessage } from '../types';
import { PersonaAvatar } from './PersonaAvatar';

const OPEN_SPRING = {
  damping: 24,
  stiffness: 260,
  mass: 0.9,
} as const;

const CLOSE_TIMING = { duration: 220 } as const;
const COMPOSER_ROW_HEIGHT = 52;

type PersonaChatPanelProps = {
  visible: boolean;
  messages: PersonaMessage[];
  isTyping: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
};

type MessageRowProps = {
  message: PersonaMessage;
};

const PersonaMessageBubble = memo(function PersonaMessageBubble({ message }: MessageRowProps) {
  const { colors, typography, radius, gap, mode } = useTheme();
  const isUser = message.role === 'user';
  const assistantFill = mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.72)';
  const assistantBorder = mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <View
      style={[
        styles.messageRow,
        { marginBottom: gap.sm },
        isUser ? styles.messageRowUser : styles.messageRowAssistant,
      ]}
    >
      {!isUser ? <PersonaAvatar size={30} style={styles.messageAvatar} /> : null}
      <View
        style={[
          styles.bubble,
          {
            borderRadius: radius.card,
            backgroundColor: isUser ? colors.accent.default : assistantFill,
            borderColor: isUser ? colors.accent.default : assistantBorder,
          },
        ]}
      >
        <Text
          style={[
            typography.textPresets.body,
            { color: isUser ? colors.text.onAccent : colors.text.primary },
          ]}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
});

function PersonaTypingIndicator() {
  const { colors, gap, radius } = useTheme();
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 650 }), -1, true);
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={[styles.messageRow, styles.messageRowAssistant, { marginBottom: gap.sm }]}>
      <PersonaAvatar size={30} style={styles.messageAvatar} />
      <View
        style={[
          styles.typingBubble,
          {
            borderRadius: radius.card,
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              { backgroundColor: colors.text.tertiary, marginLeft: index === 0 ? 0 : 6 },
              dotStyle,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

type SuggestionChipsProps = {
  onSelect: (text: string) => void;
  visible: boolean;
};

function PersonaSuggestionChips({ onSelect, visible }: SuggestionChipsProps) {
  const { colors, typography, inset, gap, radius } = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.suggestions, { gap: gap.sm, paddingBottom: inset.sm }]}>
      {PERSONA_SUGGESTIONS.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPressIn={triggerLightImpact}
          onPress={() => onSelect(suggestion)}
          accessibilityLabel={suggestion}
          style={({ pressed }) => [
            styles.suggestionChip,
            {
              borderRadius: radius.pill,
              backgroundColor: colors.surface.secondary,
              borderColor: colors.border.subtle,
              paddingHorizontal: inset.md,
              paddingVertical: inset.sm,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Text style={[typography.textPresets.captionMedium, { color: colors.text.primary }]}>
            {suggestion}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Chat sheet for the persona assistant.
 *
 * Uses BlurView (not native GlassView) inside Modal — GlassView collapses layout
 * when hosted in a Modal on iOS 26.
 */
export function PersonaChatPanel({
  visible,
  messages,
  isTyping,
  onClose,
  onSend,
}: PersonaChatPanelProps) {
  const { colors, typography, inset, gap, radius, layout, animations, mode } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [draft, setDraft] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const progress = useSharedValue(visible ? 1 : 0);

  const panelHorizontalInset = 16;
  const panelWidth = windowWidth - panelHorizontalInset * 2;
  const restingBottom = Math.max(safeInsets.bottom, 12) + 12;
  const panelTop = safeInsets.top + 12;
  const restingPanelHeight = Math.min(windowHeight * 0.82, windowHeight - panelTop - restingBottom);
  const effectiveBottom = keyboardHeight > 0 ? keyboardHeight + 8 : restingBottom;
  const effectivePanelHeight =
    keyboardHeight > 0
      ? Math.min(restingPanelHeight, windowHeight - keyboardHeight - safeInsets.top - 20)
      : restingPanelHeight;
  const showSuggestions = messages.length <= 1 && !isTyping;
  const composerMultiline = draft.includes('\n');
  const composerFontSize = typography.fontSize.md;

  const glassBackground =
    mode === 'dark' ? 'rgba(25, 25, 22, 0.72)' : 'rgba(255, 255, 255, 0.78)';
  const glassBorder = mode === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)';

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    cancelAnimation(progress);

    if (visible) {
      setMounted(true);
      progress.value = withSpring(1, OPEN_SPRING);
      return;
    }

    if (mounted) {
      progress.value = withTiming(0, CLOSE_TIMING, (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
  }, [mounted, progress, visible]);

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length, isTyping, visible]);

  const requestClose = useCallback(() => {
    triggerSelectionHaptic();
    onClose();
  }, [onClose]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    triggerSelectionHaptic();
    onSend(trimmed);
    setDraft('');
  }, [draft, onSend]);

  const handleSuggestion = useCallback(
    (text: string) => {
      onSend(text);
    },
    [onSend],
  );

  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [32, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={triggerLightImpact}
          onPress={requestClose}
          accessibilityLabel="Close assistant chat"
        />

        <Animated.View
          style={[
            styles.panelShell,
            FLOATING_CHROME_ELEVATION,
            {
              bottom: effectiveBottom,
              height: effectivePanelHeight,
              left: panelHorizontalInset,
              width: panelWidth,
              borderRadius: radius.cardLarge,
            },
            panelStyle,
          ]}
        >
          <View
            style={[
              styles.panelFrame,
              {
                borderRadius: radius.cardLarge,
                borderColor: glassBorder,
                backgroundColor: glassBackground,
              },
            ]}
          >
            <BlurView
              intensity={mode === 'dark' ? 55 : 65}
              tint={mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
              style={[StyleSheet.absoluteFill, { borderRadius: radius.cardLarge }]}
            />

            <View style={[styles.flex, styles.panelContentLayer]}>
              <View style={[styles.header, { paddingHorizontal: inset.md, paddingTop: inset.md, gap: gap.md }]}>
                <View style={[styles.headerIdentity, { gap: gap.sm }]}>
                  <PersonaAvatar size={40} showRing />
                  <View style={styles.headerCopy}>
                    <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                      {PERSONA_ASSISTANT_NAME}
                    </Text>
                    <Text style={[typography.textPresets.caption, { color: colors.text.secondary }]}>
                      Preview
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPressIn={triggerLightImpact}
                  onPress={requestClose}
                  accessibilityLabel="Minimize chat"
                  style={({ pressed }) => [
                    styles.closeButton,
                    {
                      width: layout.appHeaderIconTouch,
                      height: layout.appHeaderIconTouch,
                      borderRadius: radius.pill,
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.subtle,
                      opacity: pressed ? animations.alpha.pressed : animations.alpha.visible,
                    },
                  ]}
                >
                  <Ionicons name="chevron-down" size={typography.fontSize.lg} color={colors.text.primary} />
                </Pressable>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={{
                  paddingHorizontal: inset.md,
                  paddingTop: inset.md,
                  paddingBottom: inset.sm,
                  flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {messages.map((message) => (
                  <PersonaMessageBubble key={message.id} message={message} />
                ))}
                {isTyping ? <PersonaTypingIndicator /> : null}
              </ScrollView>

              <View style={{ paddingHorizontal: inset.md }}>
                <PersonaSuggestionChips onSelect={handleSuggestion} visible={showSuggestions} />
              </View>

              <View style={[styles.composerWrap, { paddingHorizontal: inset.md, paddingBottom: inset.md }]}>
                <View
                  style={[
                    styles.composer,
                    {
                      borderRadius: radius.pill,
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.subtle,
                      paddingLeft: inset.md,
                      paddingRight: inset.xs,
                      alignItems: composerMultiline ? 'flex-end' : 'center',
                      height: composerMultiline ? undefined : COMPOSER_ROW_HEIGHT,
                      minHeight: COMPOSER_ROW_HEIGHT,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.composerInputWrap,
                      {
                        height: composerMultiline ? undefined : COMPOSER_ROW_HEIGHT,
                        minHeight: composerMultiline ? COMPOSER_ROW_HEIGHT : undefined,
                      },
                    ]}
                  >
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Ask about classes, belts, check-in…"
                      placeholderTextColor={colors.text.tertiary}
                      multiline={composerMultiline}
                      scrollEnabled={composerMultiline}
                      style={[
                        styles.composerInput,
                        {
                          color: colors.text.primary,
                          fontSize: composerFontSize,
                        },
                      ]}
                      maxLength={500}
                      returnKeyType="send"
                      onSubmitEditing={handleSend}
                      blurOnSubmit={false}
                      onFocus={() => {
                        requestAnimationFrame(() => {
                          scrollRef.current?.scrollToEnd({ animated: true });
                        });
                      }}
                    />
                  </View>
                  <Pressable
                    onPressIn={triggerLightImpact}
                    onPress={handleSend}
                    disabled={!draft.trim() || isTyping}
                    accessibilityLabel="Send message"
                    style={({ pressed }) => [
                      styles.sendButton,
                      {
                        backgroundColor: draft.trim() ? colors.accent.default : colors.surface.tertiary,
                        opacity: pressed ? animations.alpha.pressed : animations.alpha.visible,
                      },
                    ]}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={18}
                      color={draft.trim() ? colors.text.onAccent : colors.text.tertiary}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  panelShell: {
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 130,
  },
  panelFrame: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: 'hidden',
  },
  panelContentLayer: {
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  closeButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginTop: 4,
  },
  messages: {
    flex: 1,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: 8,
  },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingBubble: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typingDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestionChip: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerWrap: {
    paddingTop: 4,
  },
  composer: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: 0,
  },
  composerInputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  composerInput: {
    includeFontPadding: false,
    margin: 0,
    maxHeight: 120,
    paddingBottom: 0,
    paddingTop: 0,
    textAlignVertical: 'center',
    width: '100%',
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 8,
    width: 36,
  },
});
