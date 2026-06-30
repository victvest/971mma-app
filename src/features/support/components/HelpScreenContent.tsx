import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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

import { RevealOnMount } from '@/shared/animations';
import { AppScrollView, Button, Card, ScreenSectionHeader } from '@/shared/components/ui';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { validateEmail } from '@/features/auth/services/authValidation';
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
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <Card
        padded={false}
        style={[
          styles.contactRow,
          {
            borderRadius: radius.cardLarge,
            paddingHorizontal: inset.md,
            paddingVertical: inset.md,
            gap: gap.md,
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
      </Card>
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
    <Card
      padded={false}
      style={[
        styles.faqCard,
        {
          borderColor: expanded ? colors.accent.default : colors.border.subtle,
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
          <Ionicons
            name="chevron-down"
            size={18}
            color={expanded ? colors.accent.default : colors.text.tertiary}
          />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.faqBodyClip, bodyStyle]}>
        <View
          onLayout={handleLayout}
          style={[
            styles.faqBodyMeasure,
            {
              paddingHorizontal: inset.md,
              paddingBottom: inset.md,
              backgroundColor: colors.surface.primary,
            },
          ]}
        >
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {item.answer}
          </Text>
        </View>
      </Animated.View>
    </Card>
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
          backgroundColor: selected ? colors.brand.red : colors.surface.primary,
          borderColor: selected ? colors.brand.red : colors.border.default,
          borderRadius: radius.pill,
        },
      ]}
    >
      <Text
        style={[
          typography.textPresets.buttonSmall,
          { color: selected ? colors.brand.onRed : colors.text.primary },
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
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const isAnonymousGuest = role === 'guest' && user === null;
  const [expandedId, setExpandedId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);
  const [category, setCategory] = useState<SupportCategory>('general');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const submitMutation = useSubmitSupportMessage();

  const toggleFaq = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const canSubmit = useMemo(() => {
    if (submitMutation.isPending) return false;
    if (subject.trim().length === 0 || message.trim().length === 0) return false;
    if (!isAnonymousGuest) return true;
    return fullName.trim().length > 0 && validateEmail(email) === null;
  }, [subject, message, submitMutation.isPending, isAnonymousGuest, fullName, email]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    triggerLightImpact();
    submitMutation.mutate(
      {
        category,
        subject: subject.trim(),
        message: message.trim(),
        ...(isAnonymousGuest
          ? {
              contactName: fullName.trim(),
              contactEmail: email.trim(),
            }
          : {}),
      },
      {
        onSuccess: () => {
          setSubject('');
          setMessage('');
          setCategory('general');
          if (isAnonymousGuest) {
            setFullName('');
            setEmail('');
          }
          toast.success('Message sent', 'Our team will get back to you soon.');
        },
        onError: (error) => {
          toast.error('Could not send', friendlySupportError(error));
        },
      },
    );
  }, [canSubmit, category, subject, message, submitMutation, isAnonymousGuest, fullName, email]);

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
        paddingTop: 8,
        paddingBottom: inset.xl,
        gap: gap.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Intro */}
      <RevealOnMount delay={0}>
        <ScreenSectionHeader kicker="HELP & SUPPORT" />
        <Text style={[typography.textPresets.homeHero, { color: colors.text.primary, marginTop: gap.xs }]}>
          We’re here to help
        </Text>
        <Text
          style={[
            typography.textPresets.body,
            styles.introBody,
            { color: colors.text.secondary, marginTop: gap.xs },
          ]}
        >
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
        <ScreenSectionHeader kicker="SEND A MESSAGE" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipRow, { gap: gap.xs }]}
        >
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
        </ScrollView>

        {isAnonymousGuest ? (
          <>
            <View style={{ gap: gap.xs }}>
              <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                Full name
              </Text>
              <View
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.surface.secondary,
                    borderRadius: radius.input,
                    paddingHorizontal: inset.md,
                  },
                ]}
              >
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={120}
                  autoCapitalize="words"
                  returnKeyType="next"
                  style={[styles.inputText, { color: colors.text.primary }]}
                />
              </View>
            </View>

            <View style={{ gap: gap.xs }}>
              <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>Email</Text>
              <View
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.surface.secondary,
                    borderRadius: radius.input,
                    paddingHorizontal: inset.md,
                  },
                ]}
              >
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={120}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  style={[styles.inputText, { color: colors.text.primary }]}
                />
              </View>
            </View>
          </>
        ) : null}

        <Card
          padded={false}
          style={[styles.messageCard, { borderRadius: radius.cardLarge }]}
        >
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="What's this about?"
            placeholderTextColor={colors.text.tertiary}
            maxLength={120}
            returnKeyType="next"
            style={[
              styles.subjectInput,
              typography.textPresets.body,
              {
                color: colors.text.primary,
                borderBottomColor: colors.border.subtle,
                paddingHorizontal: inset.md,
              },
            ]}
          />
          <View style={[styles.messageArea, { padding: inset.md }]}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us how we can help…"
              placeholderTextColor={colors.text.tertiary}
              maxLength={MAX_MESSAGE}
              multiline
              textAlignVertical="top"
              style={[
                styles.messageInput,
                typography.textPresets.body,
                { color: colors.text.primary },
              ]}
            />
            <Text
              style={[
                typography.textPresets.caption,
                styles.counterInCard,
                { color: colors.text.tertiary },
              ]}
            >
              {message.length}/{MAX_MESSAGE}
            </Text>
          </View>
        </Card>

        <Button
          label="Send message"
          icon="paper-plane-outline"
          onPress={handleSubmit}
          loading={submitMutation.isPending}
          disabled={!canSubmit}
        />
      </RevealOnMount>

      {/* FAQ */}
      <RevealOnMount delay={240} style={{ gap: gap.md }}>
        <ScreenSectionHeader kicker="FREQUENTLY ASKED" />
        <View style={{ gap: gap.sm }}>
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
  chipRow: {
    flexDirection: 'row',
    paddingRight: 4,
  },
  chip: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputField: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 54,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  introBody: {
    lineHeight: 22,
  },
  messageCard: {
    overflow: 'hidden',
  },
  subjectInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 52,
    paddingVertical: 0,
  },
  messageArea: {
    minHeight: 140,
  },
  messageInput: {
    flex: 1,
    minHeight: 96,
    paddingVertical: 0,
  },
  counterInCard: {
    marginTop: 4,
    textAlign: 'right',
  },
});
