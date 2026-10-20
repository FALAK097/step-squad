import { neon } from '@/lib/utils/neon';
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
      const { data, error } = await neon
        .from('profiles')
        .select('step_goal')
        .eq('id', session.user.id)
        .single();

      if (error && (error as any).code !== 'PGRST116') throw error;
      if ((data as any)?.step_goal) {
        setGoalState((data as any).step_goal);
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
        const { error } = await neon
          .from('profiles')
          .update({ step_goal: newGoal })
          .eq('id', session.user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating step goal:', error);
      }
    },
    [session?.user]
  );

  return { goal, setGoal, loading };
}
