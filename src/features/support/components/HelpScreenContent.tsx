import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { AcademyEyebrow } from '@/shared/components/brand';
import { RevealOnMount } from '@/shared/animations';
import { AppScrollView, Button } from '@/shared/components/ui';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { ACADEMY_CONTACT } from '@/features/about/content/academyContent';
import { FAQ_ITEMS, SUPPORT_CATEGORIES, type FaqItem } from '@/features/support/data/faq';
import { useSubmitSupportMessage } from '@/features/support/hooks/useSubmitSupportMessage';
import {
  friendlySupportError,
  type SupportCategory,
} from '@/features/support/services/supportMessages';

const MAX_MESSAGE = 2000;

type ContactAction = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  url: string;
};

const CONTACT_ACTIONS: readonly ContactAction[] = [
  {
    id: 'email',
    icon: 'mail-outline',
    label: 'Email us',
    value: ACADEMY_CONTACT.email,
    url: `mailto:${ACADEMY_CONTACT.email}`,
  },
  {
    id: 'whatsapp',
    icon: 'logo-whatsapp',
    label: 'WhatsApp',
    value: ACADEMY_CONTACT.phone,
    url: `https://wa.me/${ACADEMY_CONTACT.phoneTel.replace('+', '')}`,
  },
  {
    id: 'call',
    icon: 'call-outline',
    label: 'Call the gym',
    value: ACADEMY_CONTACT.phone,
    url: `tel:${ACADEMY_CONTACT.phoneTel}`,
  },
] as const;

// ─── Contact row ───────────────────────────────────────────────────────────────
const ContactRow = memo(function ContactRow({ action }: { action: ContactAction }) {
  const { colors, typography, radius, inset, gap } = useTheme();

  const handlePress = useCallback(() => {
    triggerLightImpact();
    Linking.openURL(action.url).catch(() => {
      toast.error('Could not open', 'No app available to handle this action.');
    });
  }, [action.url]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${action.label}: ${action.value}`}
      style={({ pressed }) => [
        styles.contactRow,
        {
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          paddingHorizontal: inset.md,
          paddingVertical: inset.md,
          gap: gap.md,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.contactIcon,
          { backgroundColor: colors.accent.subtle, borderRadius: radius.pill },
        ]}
      >
        <Ionicons name={action.icon} size={20} color={colors.accent.default} />
      </View>
      <View style={styles.contactText}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          {action.label}
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]} numberOfLines={1}>
          {action.value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </Pressable>
  );
});

// ─── FAQ accordion item ────────────────────────────────────────────────────────
const FaqAccordionItem = memo(function FaqAccordionItem({
  item,
  expanded,
  onToggle,
}: {
  item: FaqItem;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const { colors, typography, radius, inset } = useTheme();
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useSharedValue(expanded ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: 240 });
  }, [expanded, progress]);

  const bodyStyle = useAnimatedStyle(
    () => ({
      height: progress.value * contentHeight,
      opacity: progress.value,
    }),
    [contentHeight],
  );

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContentHeight(e.nativeEvent.layout.height);
  }, []);

  const handlePress = useCallback(() => {
    triggerLightImpact();
    onToggle(item.id);
  }, [item.id, onToggle]);

  return (
    <View
      style={[
        styles.faqCard,
        {
          backgroundColor: colors.background.elevated,
          borderColor: expanded ? `${colors.accent.default}55` : colors.border.subtle,
          borderRadius: radius.cardLarge,
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={item.question}
        accessibilityState={{ expanded }}
        style={[styles.faqHeader, { padding: inset.md }]}
      >
        <Text
          style={[typography.textPresets.bodyStrong, styles.faqQuestion, { color: colors.text.primary }]}
        >
          {item.question}
        </Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={colors.text.tertiary} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.faqBodyClip, bodyStyle]}>
        <View
          onLayout={handleLayout}
          style={[styles.faqBodyMeasure, { paddingHorizontal: inset.md, paddingBottom: inset.md }]}
        >
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {item.answer}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
});

// ─── Category chip ───────────────────────────────────────────────────────────────
const CategoryChip = memo(function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, typography, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent.default : colors.background.secondary,
          borderColor: selected ? colors.accent.default : colors.border.default,
          borderRadius: radius.pill,
        },
      ]}
    >
      <Text
        style={[
          typography.textPresets.buttonSmall,
          { color: selected ? colors.accent.onAccent : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

// ─── Main content ────────────────────────────────────────────────────────────────
export function HelpScreenContent() {
  const { colors, typography, inset, gap, radius } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);
  const [category, setCategory] = useState<SupportCategory>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [subjectFocused, setSubjectFocused] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);

  const submitMutation = useSubmitSupportMessage();

  const toggleFaq = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const canSubmit = useMemo(
    () => subject.trim().length > 0 && message.trim().length > 0 && !submitMutation.isPending,
    [subject, message, submitMutation.isPending],
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    triggerLightImpact();
    submitMutation.mutate(
      { category, subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          setSubject('');
          setMessage('');
          setCategory('general');
          toast.success('Message sent', 'Our team will get back to you soon.');
        },
        onError: (error) => {
          toast.error('Could not send', friendlySupportError(error));
        },
      },
    );
  }, [canSubmit, category, subject, message, submitMutation]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
    <AppScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingHorizontal: inset.lg,
        paddingTop: inset.sm,
        paddingBottom: inset['2xl'],
        gap: gap.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Intro */}
      <RevealOnMount delay={0}>
        <AcademyEyebrow label="Help & support" accent />
        <Text style={[typography.textPresets.title, { color: colors.text.primary, marginTop: gap.xs }]}>
          We’re here to help
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary, marginTop: gap.xs }]}>
          Browse common questions, reach the academy directly, or send us a message and we’ll reply by email.
        </Text>
      </RevealOnMount>

      {/* Contact actions */}
      <RevealOnMount delay={80} style={{ gap: gap.sm }}>
        {CONTACT_ACTIONS.map((action) => (
          <ContactRow key={action.id} action={action} />
        ))}
      </RevealOnMount>

      {/* Send a message */}
      <RevealOnMount delay={160} style={{ gap: gap.md }}>
        <AcademyEyebrow label="Send a message" showFlag={false} />

        <View style={[styles.chipWrap, { gap: gap.xs }]}>
          {SUPPORT_CATEGORIES.map((opt) => (
            <CategoryChip
              key={opt.id}
              label={opt.label}
              selected={category === opt.id}
              onPress={() => {
                triggerLightImpact();
                setCategory(opt.id);
              }}
            />
          ))}
        </View>

        {/* Subject */}
        <View style={{ gap: gap.xs }}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Subject</Text>
          <View
            style={[
              styles.inputField,
              {
                borderColor: subjectFocused ? colors.accent.default : colors.border.default,
                backgroundColor: subjectFocused ? colors.surface.primary : colors.surface.secondary,
                borderRadius: radius.input,
                paddingHorizontal: inset.md,
              },
            ]}
          >
            <TextInput
              value={subject}
              onChangeText={setSubject}
              onFocus={() => setSubjectFocused(true)}
              onBlur={() => setSubjectFocused(false)}
              placeholder="What’s this about?"
              placeholderTextColor={colors.text.tertiary}
              maxLength={120}
              returnKeyType="next"
              style={[styles.inputText, { color: colors.text.primary }]}
            />
          </View>
        </View>

        {/* Message */}
        <View style={{ gap: gap.xs }}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Message</Text>
          <View
            style={[
              styles.textAreaField,
              {
                borderColor: messageFocused ? colors.accent.default : colors.border.default,
                backgroundColor: messageFocused ? colors.surface.primary : colors.surface.secondary,
                borderRadius: radius.input,
                padding: inset.md,
              },
            ]}
          >
            <TextInput
              value={message}
              onChangeText={setMessage}
              onFocus={() => setMessageFocused(true)}
              onBlur={() => setMessageFocused(false)}
              placeholder="Tell us how we can help…"
              placeholderTextColor={colors.text.tertiary}
              maxLength={MAX_MESSAGE}
              multiline
              textAlignVertical="top"
              style={[styles.textAreaText, { color: colors.text.primary }]}
            />
          </View>
          <Text style={[typography.textPresets.caption, styles.counter, { color: colors.text.tertiary }]}>
            {message.length}/{MAX_MESSAGE}
          </Text>
        </View>

        <Button
          label="Send message"
          icon="paper-plane-outline"
          onPress={handleSubmit}
          loading={submitMutation.isPending}
          disabled={!canSubmit}
        />
      </RevealOnMount>

      {/* FAQ */}
      <RevealOnMount delay={240} style={{ gap: gap.sm }}>
        <AcademyEyebrow label="Frequently asked" showFlag={false} />
        <View style={{ gap: gap.sm, marginTop: gap.xs }}>
          {FAQ_ITEMS.map((item) => (
            <FaqAccordionItem
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={toggleFaq}
            />
          ))}
        </View>
      </RevealOnMount>

      {/* Footnote */}
      <RevealOnMount delay={320}>
        <Text
          style={[
            typography.textPresets.caption,
            { color: colors.text.tertiary, textAlign: 'center' },
          ]}
        >
          {ACADEMY_CONTACT.location} · {ACADEMY_CONTACT.instagram}
        </Text>
      </RevealOnMount>
    </AppScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contactRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  contactIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  contactText: { flex: 1, gap: 2 },
  faqCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  faqHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  faqQuestion: { flex: 1 },
  faqBodyClip: { overflow: 'hidden' },
  faqBodyMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  inputField: {
    alignItems: 'center',
    borderWidth: 1.5,
    flexDirection: 'row',
    height: 54,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  textAreaField: {
    borderWidth: 1.5,
    minHeight: 130,
  },
  textAreaText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 100,
  },
  counter: { textAlign: 'right' },
});
