import React from 'react';
import { Redirect } from 'expo-router';
import { getDefaultHomeRoute } from '@/shared/navigation/defaultHomeRoute';
import { useAuthStore } from '@/stores/useAuthStore';

export default function CoachCommunityGroupSettingsRedirect() {
  const role = useAuthStore((state) => state.role);
  return <Redirect href={getDefaultHomeRoute(role)} />;
}
