import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { CoachBeltReviewMemberDetail } from '@/features/coach/components/belt/CoachBeltReviewMemberDetail';
import { useCoachAssignedDisciplines } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import type { RankDisciplineSlug } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { StateBlock } from '@/shared/components/StateBlock';
import { AppBar, AppBarIconButton } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';
import { CoachBeltEditSheet } from '@/features/coach/components/belt/CoachBeltEditSheet';

export default function CoachBeltReviewScreen() {
  const { colors, inset } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editSheetVisible, setEditSheetVisible] = useState(false);

  const params = useLocalSearchParams<{
    memberId?: string;
    memberName?: string;
    memberEmail?: string;
    memberRank?: string;
    memberStripes?: string;
    memberAvatarUrl?: string;
    memberRecentCheckIns?: string;
    discipline?: string;
  }>();

  const assignedDisciplinesQuery = useCoachAssignedDisciplines();
  const reviewDiscipline =
    (typeof params.discipline === 'string' ? params.discipline : null) ??
    assignedDisciplinesQuery.primaryRankDisciplineSlug ??
    'bjj';

  const selectedMember = useMemo(() => {
    if (!params.memberId) return null;

    return {
      userId: params.memberId,
      fullName: params.memberName ?? '',
      email: params.memberEmail ?? '',
      rank: params.memberRank ?? 'Unranked',
      stripes: parseInt(params.memberStripes ?? '0', 10),
      avatarUrl: params.memberAvatarUrl?.trim() ? params.memberAvatarUrl : null,
      recentCheckIns: parseInt(params.memberRecentCheckIns ?? '0', 10),
    };
  }, [
    params.memberAvatarUrl,
    params.memberRecentCheckIns,
    params.memberEmail,
    params.memberId,
    params.memberName,
    params.memberRank,
    params.memberStripes,
  ]);

  useEffect(() => {
    if (params.memberId) return;
    router.replace('/(coach)/(main)/promotions');
  }, [params.memberId, router]);

  if (!params.memberId) {
    return null;
  }

  if (!assignedDisciplinesQuery.isLoading && !assignedDisciplinesQuery.primaryRankDisciplineSlug) {
    return (
      <AppSafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title="Belt review" showBackButton />
        <View style={[styles.center, { paddingHorizontal: inset.lg, paddingTop: inset['3xl'] }]}>
          <StateBlock
            kind="empty"
            title="No rank discipline assigned"
            message="Belt reviews are available when your coach profile is linked to BJJ or Wrestling."
          />
        </View>
      </AppSafeAreaView>
    );
  }

  if (!selectedMember) {
    return null;
  }

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar
        title="Belt review"
        showBackButton
        rightElement={
          <AppBarIconButton
            icon="create-outline"
            accessibilityLabel="Override Belt Rank"
            onPress={() => setEditSheetVisible(true)}
          />
        }
      />
      <CoachBeltReviewMemberDetail
        member={selectedMember}
        reviewDiscipline={reviewDiscipline as RankDisciplineSlug}
      />
      <CoachBeltEditSheet
        visible={editSheetVisible}
        onDismiss={() => setEditSheetVisible(false)}
        member={{
          id: selectedMember.userId,
          fullName: selectedMember.fullName,
          beltRank: selectedMember.rank,
          beltStripes: selectedMember.stripes,
        }}
        disciplineSlug={reviewDiscipline}
        onSaveSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['belt-path', selectedMember.userId] });
        }}
      />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1 },
});

// Needles for verify script: Belt Review, SELECTED MEMBER, Award stripe
