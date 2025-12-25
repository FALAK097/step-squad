import { supabase } from '@/lib/utils/supabase';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export type Squad = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  created_by: string;
};

export type SquadMember = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  total_steps?: number;
};

export function useSquads() {
  const { session } = useAuth();
  const [mySquads, setMySquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMySquads = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('squad_members')
        .select(
          `
          squads (*)
        `
        )
        .eq('user_id', session.user.id);

      if (error) throw error;
      setMySquads(data.map((item: any) => item.squads));
    } catch (error) {
      console.error('Error fetching squads:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    fetchMySquads();
  }, [fetchMySquads]);

  const createSquad = async (name: string, description: string) => {
    if (!session?.user) return null;
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: squad, error: squadError } = await supabase
        .from('squads')
        .insert({
          name,
          description,
          created_by: session.user.id,
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (squadError) throw squadError;

      const { error: memberError } = await supabase.from('squad_members').insert({
        squad_id: squad.id,
        user_id: session.user.id,
        role: 'admin',
      });

      if (memberError) throw memberError;

      await fetchMySquads();
      return squad;
    } catch (error) {
      console.error('Error creating squad:', error);
      return null;
    }
  };

  const joinSquadWithCode = async (inviteCode: string) => {
    if (!session?.user) return { error: 'Not logged in' };
    try {
      const { data: squad, error: squadError } = await supabase
        .from('squads')
        .select('id')
        .eq('invite_code', inviteCode)
        .single();

      if (squadError) throw new Error('Invalid invite code');

      const { error: memberError } = await supabase.from('squad_members').insert({
        squad_id: squad.id,
        user_id: session.user.id,
      });

      if (memberError) {
        if (memberError.code === '23505') throw new Error('You are already in this squad');
        throw memberError;
      }

      await fetchMySquads();
      return { success: true, squad_id: squad.id };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const leaveSquad = async (squadId: string) => {
    if (!session?.user) return;
    try {
      const { error } = await supabase
        .from('squad_members')
        .delete()
        .eq('squad_id', squadId)
        .eq('user_id', session.user.id);

      if (error) throw error;
      await fetchMySquads();
    } catch (error) {
      console.error('Error leaving squad:', error);
    }
  };

  const deleteSquad = async (squadId: string) => {
    if (!session?.user) return;
    try {
      const { error } = await supabase
        .from('squads')
        .delete()
        .eq('id', squadId)
        .eq('created_by', session.user.id);

      if (error) throw error;
      await fetchMySquads();
    } catch (error) {
      console.error('Error deleting squad:', error);
    }
  };

  return {
    mySquads,
    loading,
    createSquad,
    joinSquadWithCode,
    leaveSquad,
    deleteSquad,
    refresh: fetchMySquads,
  };
}

export function useSquadDetails(squadId: string, timeframe: 'daily' | 'weekly' = 'weekly') {
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembersAndSteps = useCallback(async () => {
    if (!squadId) return;
    setLoading(true);
    try {
      // Manual join because automatic relationship detection failed PGRST200
      const { data: membersData, error: membersError } = await supabase
        .from('squad_members')
        .select(
          `
          user_id,
          role
        `
        )
        .eq('squad_id', squadId);

      if (membersError) throw membersError;

      const userIds = membersData.map((m) => m.user_id);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Calculate start date based on timeframe
      const startDate = new Date();
      if (timeframe === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      }
      const dateStr =
        timeframe === 'daily'
          ? new Date().toISOString().split('T')[0]
          : startDate.toISOString().split('T')[0];

      const { data: stepsData, error: stepsError } = await supabase
        .from('daily_steps')
        .select('user_id, steps')
        .gte('date', dateStr)
        .in('user_id', userIds);

      if (stepsError) throw stepsError;

      const membersList: SquadMember[] = membersData.map((m: any) => {
        const profile = profilesData?.find((p) => p.id === m.user_id);
        const userSteps =
          stepsData
            ?.filter((s) => s.user_id === m.user_id)
            .reduce((acc, curr) => acc + curr.steps, 0) || 0;

        return {
          user_id: m.user_id,
          display_name: profile?.display_name || 'Anonymous',
          avatar_url: profile?.avatar_url || null,
          role: m.role,
          total_steps: userSteps,
        };
      });

      setMembers(membersList.sort((a, b) => (b.total_steps || 0) - (a.total_steps || 0)));
    } catch (error) {
      console.error('Error fetching squad details:', error);
    } finally {
      setLoading(false);
    }
  }, [squadId, timeframe]);

  useEffect(() => {
    fetchMembersAndSteps();
  }, [fetchMembersAndSteps]);

  return { members, loading, refresh: fetchMembersAndSteps };
}
