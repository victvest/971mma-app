import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useApproveGuardianLinkAdmin,
  usePendingGuardianLinksAdmin,
  useRejectGuardianLinkAdmin,
} from '@/features/guardian/hooks/useGuardian';
import { Button, TextField } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import type { GuardianLinkItem } from '@/types/domain';

function PendingLinkRow({ link }: { link: GuardianLinkItem }) {
  const { colors, typography } = useTheme();
  const approveMutation = useApproveGuardianLinkAdmin();
  const rejectMutation = useRejectGuardianLinkAdmin();
  const [mindbodyClientId, setMindbodyClientId] = useState(link.mindbodyClientId ?? '');
  const [traineeUserId, setTraineeUserId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const busy =
    (approveMutation.isPending && approveMutation.variables?.linkId === link.id) ||
    (rejectMutation.isPending && rejectMutation.variables?.linkId === link.id);

  const handleApprove = useCallback(async () => {
    await approveMutation.mutateAsync({
      linkId: link.id,
      mindbodyClientId: mindbodyClientId.trim() || undefined,
      traineeUserId: traineeUserId.trim() || undefined,
      accountMode: link.accountMode,
      allowGuardianQr: link.allowGuardianQr,
    });
  }, [approveMutation, link.accountMode, link.allowGuardianQr, link.id, mindbodyClientId, traineeUserId]);

  const handleReject = useCallback(async () => {
    await rejectMutation.mutateAsync({
      linkId: link.id,
      reason: rejectReason.trim() || undefined,
    });
    setShowReject(false);
    setRejectReason('');
  }, [rejectMutation, link.id, rejectReason]);

  return (
    <View style={[styles.row, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}>
      <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
        {link.childDisplayName}
      </Text>
      <Text style={[styles.meta, { color: colors.text.tertiary }]}>
        {link.accountMode === 'managed' ? 'MANAGED — parent QR' : 'INDEPENDENT — own phone'}
      </Text>
      {link.childEmail ? (
        <Text style={[styles.meta, { color: colors.text.secondary }]}>Email hint: {link.childEmail}</Text>
      ) : null}
      {link.requestNotes ? (
        <Text style={[styles.meta, { color: colors.text.secondary }]}>{link.requestNotes}</Text>
      ) : null}
      {link.mindbodyClientId ? (
        <Text style={[styles.meta, { color: colors.text.tertiary }]}>
          Requested academy client ID: {link.mindbodyClientId}
        </Text>
      ) : null}
      <Text style={[styles.meta, { color: colors.text.tertiary }]}>
        Requested {new Date(link.requestedAt).toLocaleDateString()}
      </Text>

      <TextField
        label="Existing trainee user ID (independent teens)"
        value={traineeUserId}
        onChangeText={setTraineeUserId}
        placeholder="Optional — link existing child account"
        autoCapitalize="none"
      />
      <TextField
        label="Academy client ID (staff only, optional)"
        value={mindbodyClientId}
        onChangeText={setMindbodyClientId}
        placeholder="Match trainee in academy system"
        autoCapitalize="none"
      />

      {showReject ? (
        <TextField
          label="Rejection reason (optional)"
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder="Why this request was declined"
          multiline
        />
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Approve"
          onPress={() => void handleApprove()}
          loading={approveMutation.isPending && approveMutation.variables?.linkId === link.id}
          disabled={busy}
          style={styles.actionBtn}
        />
        {showReject ? (
          <Button
            label="Confirm reject"
            variant="outline"
            onPress={() => void handleReject()}
            loading={rejectMutation.isPending && rejectMutation.variables?.linkId === link.id}
            disabled={busy}
            style={styles.actionBtn}
          />
        ) : (
          <Button
            label="Reject"
            variant="outline"
            onPress={() => setShowReject(true)}
            disabled={busy}
            style={styles.actionBtn}
          />
        )}
      </View>
    </View>
  );
}

export function PendingGuardianApprovalsPanel() {
  const { colors } = useTheme();
  const pendingQuery = usePendingGuardianLinksAdmin();

  if (pendingQuery.isLoading) {
    return <StateBlock kind="loading" title="Loading guardian requests" />;
  }

  if (pendingQuery.error) {
    return (
      <StateBlock
        kind="error"
        title="Could not load guardian requests"
        message={pendingQuery.error instanceof Error ? pendingQuery.error.message : 'Please try again.'}
        actionLabel="Retry"
        onAction={() => pendingQuery.refetch()}
      />
    );
  }

  const links = pendingQuery.data ?? [];

  return (
    <View style={[styles.card, { backgroundColor: colors.background.secondary }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Pending guardian approvals</Text>
      <Text style={[styles.body, { color: colors.text.secondary }]}>
        Review parent requests before a managed trainee profile becomes switchable in the app.
      </Text>

      {links.length === 0 ? (
        <Text style={[styles.empty, { color: colors.text.tertiary }]}>No pending requests.</Text>
      ) : (
        <View style={styles.list}>
          {links.map((link) => <PendingLinkRow key={link.id} link={link} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, marginTop: 16, gap: 10 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  empty: { fontSize: 13, marginTop: 4 },
  list: { gap: 12, marginTop: 8 },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  meta: { fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1 },
});
