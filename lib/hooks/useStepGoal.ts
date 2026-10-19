import { api } from '@/lib/utils/api';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

const DEFAULT_GOAL = 10000;

export function useStepGoal() {
  const { session } = useAuth();
  const [goal, setGoalState] = useState<number>(DEFAULT_GOAL);
  const [loading, setLoading] = useState(true);

  const fetchGoal = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ step_goal: number | null }>('/profile');
      if (data?.step_goal) {
        setGoalState(data.step_goal);
      }
    } catch (error) {
      console.error('Error fetching step goal:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  const setGoal = useCallback(
    async (newGoal: number) => {
      if (!session?.user || newGoal <= 0) return;
      try {
        setGoalState(newGoal);
        await api.put('/profile', { step_goal: newGoal });
      } catch (error) {
        console.error('Error updating step goal:', error);
      }
    },
    [session?.user]
  );

  return { goal, setGoal, loading };
}
