import { supabase } from '@/lib/utils/supabase';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getLocalDateString, getWeekRange, getLastNDaysRange } from '../utils/date';

export type DailyStepRecord = {
  date: string;
  steps: number;
};

export function useStepHistory(mode: 'week' | 'month' | 'last-14' = 'week', offset: number = 0) {
  const { session } = useAuth();
  const [history, setHistory] = useState<DailyStepRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    try {
      let startDate: Date;
      let endDate: Date;

      if (mode === 'week') {
        const range = getWeekRange(offset);
        startDate = new Date(range.start);
        endDate = new Date(range.end);
      } else if (mode === 'month') {
        // Current month with offset
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
      } else {
        // Last 14 days
        const range = getLastNDaysRange(14);
        startDate = new Date(range.start);
        endDate = new Date(range.end);
      }

      const startDateString = getLocalDateString(startDate);
      const endDateString = getLocalDateString(endDate);

      const { data, error } = await supabase
        .from('daily_steps')
        .select('date, steps')
        .eq('user_id', session.user.id)
        .gte('date', startDateString)
        .lte('date', endDateString)
        .order('date', { ascending: true });

      if (error) throw error;

      // Fill missing days
      const filledData: DailyStepRecord[] = [];
      const curr = new Date(startDate);
      // Ensure time doesn't mess up the comparison
      curr.setHours(0, 0, 0, 0);
      const endCmp = new Date(endDate);
      endCmp.setHours(23, 59, 59, 999);

      while (curr <= endCmp) {
        const dStr = getLocalDateString(curr);
        const existing = data?.find((d) => d.date === dStr);
        filledData.push(existing || { date: dStr, steps: 0 });
        curr.setDate(curr.getDate() + 1);
      }

      setHistory(filledData);
    } catch (error) {
      console.error('Error fetching step history:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, mode, offset]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, refresh: fetchHistory };
}
