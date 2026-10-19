import { api, qs } from '@/lib/utils/api';
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
      setMySquads(await api.get<Squad[]>('/squads'));
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
      const squad = await api.post<Squad>('/squads', { name, description });
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
      const { squad_id, squad } = await api.post<{ squad_id: string; squad: Squad }>(
        '/squads/join',
        { invite_code: inviteCode }
      );
      await fetchMySquads();
      return { success: true, squad_id, squad };
    } catch (error: any) {
      return { error: error.message as string };
    }
  };

  const leaveSquad = async (squadId: string) => {
    if (!session?.user) return;
    try {
      await api.post(`/squads/${squadId}/leave`);
      await fetchMySquads();
    } catch (error) {
      console.error('Error leaving squad:', error);
    }
  };

  const deleteSquad = async (squadId: string) => {
    if (!session?.user) return;
    try {
      await api.delete(`/squads/${squadId}`);
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
      // Calculate start date based on timeframe
      const startDate = new Date();
      if (timeframe === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      }
      const since =
        timeframe === 'daily'
          ? new Date().toISOString().split('T')[0]
          : startDate.toISOString().split('T')[0];

      // The API returns members already ranked by total steps since `since`.
      setMembers(await api.get<SquadMember[]>(`/squads/${squadId}/members?${qs({ since })}`));
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
