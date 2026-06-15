import { useCallback, useEffect, useMemo, useState } from 'react';
import { trainingSessions } from '../data/memberFeatures';
import type { TrainingSession } from '../data/memberFeatures';
import { listMyCheckIns } from '../services/db';
import { deriveTrainingStats, mapCheckInToSession } from '../utils/trainingHistory';

export function useTrainingHistory() {
  const [sessions, setSessions] = useState<TrainingSession[]>(trainingSessions);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<'live' | 'mock'>('mock');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const rows = await listMyCheckIns(80);
      if (rows.length) {
        setSessions(rows.map((row) => mapCheckInToSession(row, row.classes)));
        setSource('live');
      } else {
        setSessions(trainingSessions);
        setSource('mock');
      }
    } catch {
      setSessions(trainingSessions);
      setSource('mock');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => deriveTrainingStats(sessions), [sessions]);

  const refresh = useCallback(() => load(true), [load]);

  const prependSession = useCallback((session: TrainingSession) => {
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
    setSource('live');
  }, []);

  return { sessions, stats, loading, refreshing, refresh, source, prependSession };
}
