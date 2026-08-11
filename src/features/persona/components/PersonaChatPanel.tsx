import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { PERSONA_ASSISTANT_NAME } from '../constants';
import type { PersonaAction, PersonaMessage } from '../types';
import { navigatePersonaAction } from '../utils/personaActions';
import { PersonaAvatar } from './PersonaAvatar';
import { LiquidGlassSurface } from '@/shared/components/ui/LiquidGlassSurface';

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
  suggestions: readonly string[];
  onClose: () => void;
  onSend: (text: string) => void;
};

type MessageRowProps = {
  message: PersonaMessage;
  onActionPress: (action: PersonaAction) => void;
};

type ChatBlock =
  | { type: 'text'; content: string }
  | { type: 'heading'; content: string; level: number }
  | { type: 'bullet'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | {
      type: 'card';
      title?: string;
      subtitle?: string;
      stats?: { label: string; value: string }[];
      items?: string[];
      theme?: string;
      content?: string;
    };

const BULLET_LINE_PATTERN = /^\s*(?:[•*-]|\d+[.)])\s+/;

function isCompactHeading(line: string): boolean {
  return line.endsWith(':') && line.length <= 44 && !/[.!?]$/.test(line.slice(0, -1));
}

function cleanClassTitle(title: string): string {
  let cleaned = title.trim();
  const parenMatch = cleaned.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch && parenMatch[1].toLowerCase() === parenMatch[2].toLowerCase()) {
    cleaned = parenMatch[1].trim();
  }
  const withParenMatch = cleaned.match(/^(.*?)\s*\((.*?)\)$/);
  if (withParenMatch) {
    const main = withParenMatch[1].toLowerCase();
    const paren = withParenMatch[2].toLowerCase();
    if (main.includes(paren) || paren.includes(main)) {
      cleaned = withParenMatch[1].trim();
    }
  }
  return cleaned;
}

function parseMarkdownBlocks(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  const lines = text.split('\n');

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (inTable && (tableHeaders.length > 0 || tableRows.length > 0)) {
      blocks.push({
        type: 'table',
        headers: tableHeaders,
        rows: tableRows,
      });
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;

    const isSchedule = bulletBuffer.every((bullet) => {
      const parts = bullet.split(/[-—–]/);
      return (
        parts.length >= 2 &&
        (bullet.includes('AM') || bullet.includes('PM') || /\d+:\d+/.test(bullet))
      );
    });

    const isKeyValue = bulletBuffer.every((bullet) => {
      const colonIndex = bullet.indexOf(':');
      if (colonIndex > 0 && colonIndex < 24) return true;
      const dashIndex = bullet.indexOf('—');
      if (dashIndex > 0 && dashIndex < 24) return true;
      const hyphenIndex = bullet.indexOf('-');
      if (hyphenIndex > 0 && hyphenIndex < 24) return true;
      return false;
    });

    if (isSchedule && bulletBuffer.length > 0) {
      const headers = ['Time/Day', 'Class', 'Coach'];
      const rows: string[][] = [];

      for (const bullet of bulletBuffer) {
        const match = bullet.match(/^(.*?)\s*[-—–]\s*(.*?)(?:\s+with\s+(.*))?$/i);
        if (match) {
          const time = match[1].trim();
          const classTitle = cleanClassTitle(match[2]);
          const coach = match[3] ? match[3].trim() : 'TBA';
          rows.push([time, classTitle, coach]);
        } else {
          const parts = bullet.split(/[-—–]/);
          const time = parts[0].trim();
          const rest = parts.slice(1).join('—').trim();
          rows.push([time, rest, 'TBA']);
        }
      }

      blocks.push({
        type: 'table',
        headers,
        rows,
      });
    } else if (isKeyValue && bulletBuffer.length > 0) {
      const stats: { label: string; value: string }[] = [];
      for (const bullet of bulletBuffer) {
        let separator = ':';
        if (bullet.includes('—')) separator = '—';
        else if (bullet.includes('-')) separator = '-';

        const parts = bullet.split(separator);
        const label = parts[0].trim();
        const value = parts.slice(1).join(separator).trim();
        stats.push({ label, value });
      }

      blocks.push({
        type: 'card',
        title: 'Summary',
        stats,
      });
    } else {
      for (const bullet of bulletBuffer) {
        blocks.push({ type: 'bullet', content: bullet });
      }
    }

    bulletBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    const isTableRow = line.startsWith('|') && line.endsWith('|') && line.split('|').length > 2;

    if (isTableRow) {
      flushBullets();
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((_, index, arr) => index > 0 && index < arr.length - 1);

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        const isSeparator = cells.every((cell) => /^:?-+:?$/.test(cell));
        if (isSeparator) {
          continue;
        }
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    if (!line) {
      flushBullets();
      continue;
    }

    if (BULLET_LINE_PATTERN.test(line)) {
      const content = line.replace(BULLET_LINE_PATTERN, '').trim();
      bulletBuffer.push(content);
      continue;
    } else {
      flushBullets();
    }

    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '').trim();
      blocks.push({ type: 'heading', content, level });
      continue;
    }

    if (isCompactHeading(line)) {
      blocks.push({ type: 'heading', content: line.slice(0, -1).trim(), level: 3 });
      continue;
    }

    blocks.push({ type: 'text', content: line });
  }

  flushTable();
  flushBullets();
  return blocks;
}

function parseMessageContent(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];

  const codeBlockRegex = /```(?:json)?\s*\n([\s\S]*?)\n\s*```/g;
  let match;
  let lastIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index).trim();
    if (textBefore) {
      blocks.push(...parseMarkdownBlocks(textBefore));
    }

    const codeContent = match[1].trim();
    try {
      const parsedJson = JSON.parse(codeContent);
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        blocks.push({
          type: 'card',
          title: parsedJson.title || parsedJson.name,
          subtitle: parsedJson.subtitle || parsedJson.description || parsedJson.date,
          stats: parsedJson.stats || parsedJson.fields || parsedJson.data,
          items: parsedJson.items || parsedJson.list || parsedJson.bullets,
          theme: parsedJson.theme || 'default',
          content: parsedJson.content || parsedJson.text || parsedJson.body,
        });
      } else {
        blocks.push({ type: 'text', content: codeContent });
      }
    } catch {
      blocks.push({ type: 'text', content: codeContent });
    }

    lastIndex = codeBlockRegex.lastIndex;
  }

  const textAfter = text.slice(lastIndex).trim();
  if (textAfter) {
    if (textAfter.startsWith('{') && textAfter.endsWith('}')) {
      try {
        const parsedJson = JSON.parse(textAfter);
        blocks.push({
          type: 'card',
          title: parsedJson.title || parsedJson.name,
          subtitle: parsedJson.subtitle || parsedJson.description || parsedJson.date,
          stats: parsedJson.stats || parsedJson.fields || parsedJson.data,
          items: parsedJson.items || parsedJson.list || parsedJson.bullets,
          theme: parsedJson.theme || 'default',
          content: parsedJson.content || parsedJson.text || parsedJson.body,
        });
      } catch {
        // Ignore and treat as markdown
      }
    }
    blocks.push(...parseMarkdownBlocks(textAfter));
  }

  if (blocks.length === 0 && text.trim()) {
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
      try {
        const parsedJson = JSON.parse(text.trim());
        return [
          {
            type: 'card',
            title: parsedJson.title || parsedJson.name,
            subtitle: parsedJson.subtitle || parsedJson.description || parsedJson.date,
            stats: parsedJson.stats || parsedJson.fields || parsedJson.data,
            items: parsedJson.items || parsedJson.list || parsedJson.bullets,
            theme: parsedJson.theme || 'default',
            content: parsedJson.content || parsedJson.text || parsedJson.body,
          },
        ];
      } catch {
        // Ignore
      }
    }
    blocks.push(...parseMarkdownBlocks(text));
  }

  return blocks;
}

const UAEFlagBadge = () => (
  <View
    style={{
      flexDirection: 'row',
      width: 16,
      height: 10,
      borderRadius: 1.5,
      overflow: 'hidden',
      borderWidth: 0.5,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    }}
  >
    <View style={{ width: 4, backgroundColor: '#FF0000' }} />
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: '#00843D' }} />
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
      <View style={{ flex: 1, backgroundColor: '#000000' }} />
    </View>
  </View>
);

function renderInlineMarkdown(
  text: string,
  color: string,
  typography: ReturnType<typeof useTheme>['typography'],
) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={{ color }}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={index} style={[typography.textPresets.bodyStrong, { color }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

type TableProps = {
  headers: string[];
  rows: string[][];
  color: string;
};

const AssistantMessageTable = memo(function AssistantMessageTable({
  headers,
  rows,
  color,
}: TableProps) {
  const { colors, typography, radius, mode } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 4, marginBottom: 4 }}
    >
      <View
        style={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border.subtle,
          borderRadius: radius.card,
          overflow: 'hidden',
          backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border.subtle,
            paddingVertical: 8,
            paddingHorizontal: 12,
          }}
        >
          {headers.map((header, idx) => (
            <View key={idx} style={{ minWidth: 90, paddingHorizontal: 6 }}>
              <Text style={[typography.textPresets.captionMedium, { color }]}>{header}</Text>
            </View>
          ))}
        </View>

        {rows.map((row, rowIdx) => (
          <View
            key={rowIdx}
            style={{
              flexDirection: 'row',
              borderBottomWidth: rowIdx === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: colors.border.subtle,
              backgroundColor:
                rowIdx % 2 === 0
                  ? 'transparent'
                  : mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(0, 0, 0, 0.01)',
              paddingVertical: 8,
              paddingHorizontal: 12,
            }}
          >
            {row.map((cell, cellIdx) => (
              <View key={cellIdx} style={{ minWidth: 90, paddingHorizontal: 6 }}>
                <Text style={[typography.textPresets.caption, { color }]}>{cell}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
});

type CardProps = {
  title?: string;
  subtitle?: string;
  stats?: { label: string; value: string }[];
  items?: string[];
  content?: string;
  color: string;
};

const AssistantMessageCard = memo(function AssistantMessageCard({
  title,
  subtitle,
  stats,
  items,
  content,
}: CardProps) {
  const { colors, typography, radius, mode } = useTheme();

  return (
    <View style={{ marginVertical: 6, minWidth: 230, width: '100%' }}>
      <LiquidGlassSurface
        variant="default"
        borderRadius={radius.card}
        style={{ width: '100%' }}
        contentStyle={{ padding: 12 }}
      >
        <View
          style={{
            height: 2,
            flexDirection: 'row',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <View style={{ flex: 1, backgroundColor: '#00843D' }} />
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
          <View style={{ flex: 1, backgroundColor: '#000000' }} />
          <View style={{ width: 12, backgroundColor: '#FF0000' }} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
            marginTop: 4,
          }}
        >
          {title ? (
            <Text
              style={[
                typography.textPresets.bodyStrong,
                { color: colors.text.primary, flex: 1, marginRight: 8 },
              ]}
            >
              {title}
            </Text>
          ) : null}
          <UAEFlagBadge />
        </View>

        {subtitle ? (
          <Text
            style={[
              typography.textPresets.caption,
              { color: colors.text.secondary, marginBottom: 8 },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}

        {content ? (
          <Text
            style={[typography.textPresets.body, { color: colors.text.primary, marginBottom: 8 }]}
          >
            {content}
          </Text>
        ) : null}

        {stats && stats.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {stats.map((stat, idx) => (
              <View
                key={idx}
                style={{
                  flex: 1,
                  minWidth: '45%',
                  backgroundColor:
                    mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border.subtle,
                  borderRadius: radius.card / 1.5,
                  padding: 8,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[typography.textPresets.caption, { color: colors.text.secondary }]}
                >
                  {stat.label}
                </Text>
                <Text
                  style={[
                    typography.textPresets.bodyStrong,
                    { color: colors.text.primary, marginTop: 2 },
                  ]}
                >
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {items && items.length > 0 ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            {items.map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text
                  style={[
                    typography.textPresets.bodyStrong,
                    { color: colors.accent.default, marginRight: 6 },
                  ]}
                >
                  {'•'}
                </Text>
                <Text
                  style={[
                    typography.textPresets.caption,
                    { color: colors.text.primary, flex: 1 },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </LiquidGlassSurface>
    </View>
  );
});

type AssistantMessageTextProps = {
  color: string;
  text: string;
};

const AssistantMessageText = memo(function AssistantMessageText({
  color,
  text,
}: AssistantMessageTextProps) {
  const { typography, gap } = useTheme();
  const blocks = useMemo(() => parseMessageContent(text), [text]);

  return (
    <View style={[styles.structuredText, { gap: gap.xs }]}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case 'heading':
            return (
              <Text
                key={key}
                selectable
                style={[
                  block.level === 1
                    ? typography.textPresets.bodyStrong
                    : typography.textPresets.captionMedium,
                  { color, marginTop: gap.xs },
                ]}
              >
                {block.content}
              </Text>
            );
          case 'bullet':
            return (
              <View key={key} style={[styles.bulletRow, { gap: gap.xs }]}>
                <Text
                  selectable
                  style={[typography.textPresets.bodyStrong, styles.bulletGlyph, { color }]}
                >
                  {'•'}
                </Text>
                <View style={styles.bulletText}>
                  {renderInlineMarkdown(block.content, color, typography)}
                </View>
              </View>
            );
          case 'table':
            return (
              <AssistantMessageTable
                key={key}
                headers={block.headers}
                rows={block.rows}
                color={color}
              />
            );
          case 'card':
            return (
              <AssistantMessageCard
                key={key}
                title={block.title}
                subtitle={block.subtitle}
                stats={block.stats}
                items={block.items}
                content={block.content}
                color={color}
              />
            );
          case 'text':
          default:
            return (
              <View key={key}>{renderInlineMarkdown(block.content, color, typography)}</View>
            );
        }
      })}
    </View>
  );
});

const PersonaMessageBubble = memo(function PersonaMessageBubble({
  message,
  onActionPress,
}: MessageRowProps) {
  const { colors, typography, radius, gap, mode } = useTheme();
  const isUser = message.role === 'user';
  const assistantFill = message.isError
    ? colors.surface.secondary
    : mode === 'dark'
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(255, 255, 255, 0.72)';
  const assistantBorder = message.isError
    ? colors.border.default
    : mode === 'dark'
      ? 'rgba(255, 255, 255, 0.16)'
      : 'rgba(0, 0, 0, 0.06)';
  const messageTextColor = isUser ? colors.text.onAccent : colors.text.primary;

  return (
    <View
      style={[
        styles.messageRow,
        { marginBottom: gap.sm },
        isUser ? styles.messageRowUser : styles.messageRowAssistant,
      ]}
    >
      {!isUser ? <PersonaAvatar size={30} style={styles.messageAvatar} /> : null}
      <View style={styles.messageColumn}>
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
          {isUser ? (
            <Text selectable style={[typography.textPresets.body, { color: messageTextColor }]}>
              {message.text}
            </Text>
          ) : (
            <AssistantMessageText text={message.text} color={messageTextColor} />
          )}
        </View>
        {!isUser && message.actions?.length ? (
          <View style={[styles.actionRow, { gap: gap.xs, marginTop: gap.xs }]}>
            {message.actions.map((action) => (
              <Pressable
                key={`${message.id}-${action.route}`}
                onPressIn={triggerLightImpact}
                onPress={() => onActionPress(action)}
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.actionChip,
                  {
                    borderRadius: radius.pill,
                    backgroundColor: colors.surface.primary,
                    borderColor: colors.border.subtle,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
  suggestions: readonly string[];
  onSelect: (text: string) => void;
  visible: boolean;
};

function PersonaSuggestionChips({ suggestions, onSelect, visible }: SuggestionChipsProps) {
  const { colors, typography, inset, gap, radius } = useTheme();

  if (!visible || suggestions.length === 0) return null;

  return (
    <View style={[styles.suggestions, { gap: gap.sm, paddingBottom: inset.sm }]}>
      {suggestions.map((suggestion) => (
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
  suggestions,
  onClose,
  onSend,
}: PersonaChatPanelProps) {
  const router = useRouter();
  const { colors, typography, inset, gap, radius, layout, animations, mode, chromeElevation } =
    useTheme();
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

  const glassBackground = mode === 'dark' ? 'rgba(25, 25, 22, 0.72)' : 'rgba(255, 255, 255, 0.78)';
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

  const handleActionPress = useCallback(
    (action: PersonaAction) => {
      triggerSelectionHaptic();
      onClose();
      requestAnimationFrame(() => {
        navigatePersonaAction(router, action);
      });
    },
    [onClose, router],
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
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
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
            chromeElevation(),
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
              tint={
                mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'
              }
              style={[StyleSheet.absoluteFill, { borderRadius: radius.cardLarge }]}
            />

            <View style={[styles.flex, styles.panelContentLayer]}>
              <View
                style={[
                  styles.header,
                  { paddingHorizontal: inset.md, paddingTop: inset.md, gap: gap.md },
                ]}
              >
                <View style={[styles.headerIdentity, { gap: gap.sm }]}>
                  <PersonaAvatar size={40} showRing />
                  <View style={styles.headerCopy}>
                    <Text
                      style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
                    >
                      {PERSONA_ASSISTANT_NAME}
                    </Text>
                    <Text
                      style={[typography.textPresets.caption, { color: colors.text.secondary }]}
                    >
                      Academy assistant
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
                  <Ionicons
                    name="chevron-down"
                    size={typography.fontSize.lg}
                    color={colors.text.primary}
                  />
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
                  <PersonaMessageBubble
                    key={message.id}
                    message={message}
                    onActionPress={handleActionPress}
                  />
                ))}
                {isTyping ? <PersonaTypingIndicator /> : null}
              </ScrollView>

              <View style={{ paddingHorizontal: inset.md }}>
                <PersonaSuggestionChips
                  suggestions={suggestions}
                  onSelect={handleSuggestion}
                  visible={showSuggestions}
                />
              </View>

              <View
                style={[
                  styles.composerWrap,
                  { paddingHorizontal: inset.md, paddingBottom: inset.md },
                ]}
              >
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
                        backgroundColor: draft.trim()
                          ? colors.accent.default
                          : colors.surface.tertiary,
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
  messageColumn: {
    flexShrink: 1,
    maxWidth: '80%',
  },
  messageAvatar: {
    marginRight: 8,
  },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  structuredText: {
    minWidth: 0,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  bulletGlyph: {
    lineHeight: 23,
    textAlign: 'center',
    width: 12,
  },
  bulletText: {
    flex: 1,
    minWidth: 0,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionChip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
