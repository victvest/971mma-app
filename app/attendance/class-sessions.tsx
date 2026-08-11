import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { StateBlock } from '@/shared/components/StateBlock';

export default function ClassSessionAttendanceScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/attendance?tab=classes');
  }, [router]);

  return <StateBlock kind="loading" title="Loading attendance history..." />;
}
