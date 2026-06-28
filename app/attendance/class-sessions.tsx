import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ClassSessionAttendanceRow } from '@/features/attendance/components/ClassSessionAttendanceRow';
import { useClassSessionAttendance } from '@/features/attendance/hooks/useClassSessionAttendance';
import { AppBar, FlashListScrollComponent } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import type { ClassSessionAttendanceRow as ClassSessionRow } from '@/services/database/classAttendance.repository';

export default function ClassSessionAttendanceScreen() {
  const { colors, inset, typography } = useTheme();
  const router = useRouter();
  const attendanceQuery = useClassSessionAttendance();
  const rows = attendanceQuery.data?.pages.flat() ?? [];

  const renderItem = useCallback(
    ({ item }: { item: ClassSessionRow }) => <ClassSessionAttendanceRow item={item} />,
    [],
  );

  const hasError = !!attendanceQuery.error;
  const hasData = rows.length > 0;
  const errorMessage =
    attendanceQuery.error instanceof Error
      ? attendanceQuery.error.message
      : 'Please check your connection.';

  const listHeader = (
    <View style={[styles.headerBlock, { marginBottom: inset.md, gap: inset.sm }]}>
      {hasError && hasData ? (
        <StateBlock
          kind="error"
          title="Sync issue"
          message="Could not refresh class attendance."
          actionLabel="Retry"
          onAction={() => attendanceQuery.refetch()}
        />
      ) : null}
      <Pressable
        onPress={() => router.push('/attendance')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          Facility visits
        </Text>
        <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.default }]}>
          View all
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background.primary }]} edges={['top', 'bottom']}>
      <AppBar title="Class attendance" />

      {attendanceQuery.isLoading ? (
        <StateBlock kind="loading" title="Loading class attendance" />
      ) : hasError && !hasData ? (
        <StateBlock
          kind="error"
          title="Could not load class attendance"
          message={errorMessage}
          actionLabel="Retry"
          onAction={() => attendanceQuery.refetch()}
        />
      ) : !hasError && rows.length === 0 ? (
        <StateBlock
          kind="empty"
          title="No class attendance yet"
          message="When a coach marks you present or absent during roll call, it will appear here."
        />
      ) : (
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ padding: inset.lg, paddingTop: 12 }}
          ItemSeparatorComponent={ClassSessionSeparator}
          onEndReached={() => {
            if (attendanceQuery.hasNextPage && !attendanceQuery.isFetchingNextPage) {
              void attendanceQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            attendanceQuery.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerLoader} color={colors.accent.default} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function ClassSessionSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBlock: {},
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLoader: { marginVertical: 20 },
  separator: { height: 10 },
});
