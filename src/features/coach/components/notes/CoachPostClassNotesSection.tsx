import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatLocalDisplay } from '@/core/time/gymTime';
import { CoachMemberNoteSheet } from '@/features/coach/components/notes/CoachMemberNoteSheet';
import {
  useCoachMemberNotes,
  useSaveCoachMemberNote,
} from '@/features/coach/hooks/useCoachMemberNotes';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';

type Props = {
  classId: string;
  disciplineId: string | null;
  members: RollCallDeckMember[];
  enabled?: boolean;
};

export const CoachPostClassNotesSection = memo(function CoachPostClassNotesSection({
  classId,
  disciplineId,
  members,
  enabled = true,
}: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const notesQuery = useCoachMemberNotes(enabled ? classId : null);
  const saveMutation = useSaveCoachMemberNote(classId);
  const [activeMember, setActiveMember] = useState<RollCallDeckMember | null>(null);

  const noteableMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.userId &&
          (member.mark?.status === 'present' ||
            member.mark?.status === 'late' ||
            member.mark?.status === 'left_early'),
      ),
    [members],
  );

  const handleSave = useCallback(
    async (body: string) => {
      if (!activeMember?.userId || !disciplineId) return;
      try {
        await saveMutation.mutateAsync({
          userId: activeMember.userId,
          classId,
          disciplineId,
          body,
        });
        setActiveMember(null);
      } catch {
        // mutation error surfaced via sheet retry
      }
    },
    [activeMember, classId, disciplineId, saveMutation],
  );

  if (!enabled || !disciplineId) return null;

  return (
    <View style={{ gap: gap.md }}>
      <View style={styles.sectionHeader}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          Post-class notes
        </Text>
        <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
          Coach & admin only
        </Text>
      </View>

      {notesQuery.isLoading ? (
        <StateBlock kind="loading" title="Loading notes" />
      ) : null}

      {(notesQuery.data ?? []).length > 0 ? (
        <View style={{ gap: gap.sm }}>
          {(notesQuery.data ?? []).map((note) => (
            <View
              key={note.id}
              style={[
                styles.noteCard,
                {
                  backgroundColor: colors.surface.primary,
                  borderColor: colors.border.subtle,
                  borderRadius: radius.card,
                  borderWidth: layout.borderWidth,
                  padding: inset.md,
                  gap: gap.xs,
                },
              ]}
            >
              <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                {note.memberName}
              </Text>
              <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
                {note.body}
              </Text>
              <Text style={[typography.textPresets.captionMedium, { color: colors.text.tertiary }]}>
                {formatLocalDisplay(note.createdAt)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {noteableMembers.length > 0 ? (
        <View style={{ gap: gap.sm }}>
          {noteableMembers.map((member) => (
            <Pressable
              key={member.deckKey}
              onPress={() => setActiveMember(member)}
              style={({ pressed }) => [
                styles.memberRow,
                {
                  backgroundColor: colors.surface.primary,
                  borderColor: colors.border.subtle,
                  borderRadius: radius.card,
                  borderWidth: layout.borderWidth,
                  padding: inset.md,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Add note for ${member.displayName}`}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                  {member.displayName}
                </Text>
                <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
                  Add coaching note
                </Text>
              </View>
              <Ionicons name="create-outline" size={20} color={colors.text.tertiary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <StateBlock
          kind="empty"
          title="No attendees to note"
          message="Mark members present before adding post-class notes."
        />
      )}

      <CoachMemberNoteSheet
        visible={activeMember !== null}
        memberName={activeMember?.displayName ?? 'Member'}
        onConfirm={(body) => {
          void handleSave(body);
        }}
        onCancel={() => setActiveMember(null)}
        loading={saveMutation.isPending}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noteCard: {},
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
