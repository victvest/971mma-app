import React from 'react';
import { SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';
import { useShellSafeAreaEdges } from '@/shared/hooks/useShellSafeAreaEdges';

export function AppSafeAreaView({ edges, ...props }: SafeAreaViewProps) {
  const resolvedEdges = useShellSafeAreaEdges(edges);
  return <SafeAreaView edges={resolvedEdges} {...props} />;
}
