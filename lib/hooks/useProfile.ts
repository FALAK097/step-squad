import { api } from '@/lib/utils/api';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export function useProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ display_name: string | null; avatar_url: string | null }>(
        '/profile'
      );
      setProfile({ display_name: data.display_name, avatar_url: data.avatar_url });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    if (!session?.user) return;
    try {
      await api.put('/profile', updates);
      setProfile((prev) =>
        prev ? { ...prev, ...updates } : { display_name: null, avatar_url: null, ...updates }
      );
      return { success: true };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      return { error: error.message };
    }
  };

  return { profile, loading, updateProfile, refresh: fetchProfile };
}
