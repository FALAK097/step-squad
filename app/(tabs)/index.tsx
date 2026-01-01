import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { StepCard } from '@/components/StepCard';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import {
  ensureInitialized,
  getAvailability,
  getHealthConnectInstallUrl,
  hasStepPermission,
  openHealthConnectAppSettings,
  readTodaySteps,
  requestStepPermission,
  readDailyStepsHistory,
} from '@/lib/health/healthConnect';
import { setupNotifications } from '@/lib/notifications';
import { useStepGoal } from '@/lib/hooks/useStepGoal';
import { useStepHistory } from '@/lib/hooks/useStepHistory';
import { useProfile } from '@/lib/hooks/useProfile';
import { useSquads, useSquadDetails } from '@/lib/hooks/useSquads';
import { formatDate } from '@/lib/utils/date';
import { supabase } from '@/lib/utils/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFocusEffect, router } from 'expo-router';
import { Trophy, Users } from 'lucide-react-native';
import * as React from 'react';
import { Linking, RefreshControl, ScrollView, View, Image, Pressable } from 'react-native';
import { SvgCssUri } from 'react-native-svg/css';
import * as Haptics from 'expo-haptics';

type UiState = 'checking' | 'needsInstall' | 'needsPermission' | 'ready' | 'error';

export default function HomeScreen() {
  const [uiState, setUiState] = React.useState<UiState>('checking');
  const [steps, setSteps] = React.useState<number>(0);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const isInitialMount = React.useRef(true);

  const { goal } = useStepGoal();
  const { session } = useAuth();
  const { profile, refresh: refreshProfileData } = useProfile();
  const { mySquads, refresh: refreshSquads } = useSquads();
  const { refresh: refreshHistory } = useStepHistory('week', 0);

  const syncStepsToSupabase = React.useCallback(async () => {
    if (!session?.user) return;
    try {
      const historyData = await readDailyStepsHistory(14);
      const data = historyData.map((item) => ({
        user_id: session.user.id,
        date: item.date,
        steps: item.steps,
      }));

      const { error } = await supabase
        .from('daily_steps')
        .upsert(data, { onConflict: 'user_id,date' });

      if (error) throw error;
      refreshHistory();
    } catch (error) {
      console.error('[Sync] Error syncing steps:', error);
    }
  }, [session?.user, refreshHistory]);

  const calculateLeaderboardStatus = React.useCallback(async () => {
    if (!session?.user) {
      return { hasSquadWithOthers: false, isFirstPlace: false };
    }

    try {
      // Fetch squads directly to ensure we have latest data
      const { data: squadsData, error: squadsError } = await supabase
        .from('squad_members')
        .select('squad_id')
        .eq('user_id', session.user.id);

      if (squadsError) throw squadsError;
      if (!squadsData || squadsData.length === 0)
        return { hasSquadWithOthers: false, isFirstPlace: false };

      const squadIds = squadsData.map((s) => s.squad_id);

      // Check if any squad has other members
      const { data: membersData, error: membersError } = await supabase
        .from('squad_members')
        .select('squad_id, user_id')
        .in('squad_id', squadIds);

      if (membersError) throw membersError;

      const squadMemberCounts = squadIds.reduce(
        (acc, id) => {
          acc[id] = membersData.filter((m) => m.squad_id === id).length;
          return acc;
        },
        {} as Record<string, number>
      );

      const hasSquadWithOthers = Object.values(squadMemberCounts).some(
        (count) => (count as number) > 1
      );
      if (!hasSquadWithOthers) return { hasSquadWithOthers: false, isFirstPlace: false };

      // Get ranks
      const today = new Date().toISOString().split('T')[0];
      const { data: stepsData, error: stepsError } = await supabase
        .from('daily_steps')
        .select('user_id, steps')
        .eq('date', today)
        .in(
          'user_id',
          membersData.map((m) => m.user_id)
        );

      if (stepsError) throw stepsError;

      let userIsFirstEverywhere = true;

      for (const squadId of squadIds) {
        if (squadMemberCounts[squadId] <= 1) continue;

        const squadUserIds = membersData
          .filter((m) => m.squad_id === squadId)
          .map((m) => m.user_id);
        const squadSteps = squadUserIds
          .map((uid) => ({
            user_id: uid,
            steps: stepsData.filter((s) => s.user_id === uid).reduce((sum, s) => sum + s.steps, 0),
          }))
          .sort((a, b) => b.steps - a.steps);

        const myRank = squadSteps.findIndex((s) => s.user_id === session.user.id) + 1;
        if (myRank > 1) {
          userIsFirstEverywhere = false;
        }
      }

      return {
        hasSquadWithOthers,
        isFirstPlace: userIsFirstEverywhere && hasSquadWithOthers,
      };
    } catch (error) {
      console.error('[LeaderboardStatus] Error:', error);
      return { hasSquadWithOthers: false, isFirstPlace: false };
    }
  }, [session?.user]);

  const load = React.useCallback(
    async (options: { requestPermission: boolean }) => {
      if (refreshing) return;
      setRefreshing(true);
      setMessage(null);

      try {
        const availability = await getAvailability();
        if (availability === 'notInstalled') {
          setUiState('needsInstall');
          return;
        }
        if (availability === 'notSupported') {
          setUiState('error');
          setMessage('Health Connect is not supported on this device.');
          return;
        }

        await ensureInitialized();

        const alreadyGranted = await hasStepPermission();
        if (!alreadyGranted) {
          if (!options.requestPermission) {
            setUiState('needsPermission');
            setMessage('We need permission to read your step count.');
            return;
          }

          const permissionResult = await requestStepPermission();
          if (permissionResult !== 'granted') {
            setUiState('needsPermission');
            setMessage('Permission was denied. Please enable it to continue.');
            return;
          }
        }

        const stepData = await readTodaySteps();
        setSteps(stepData.totalSteps);
        setLastUpdated(new Date());
        setUiState('ready');

        await syncStepsToSupabase();

        const status = await calculateLeaderboardStatus();
        setupNotifications({
          steps: stepData.totalSteps,
          goal: goal,
          hasSquadWithOthers: status.hasSquadWithOthers,
          isFirstPlace: status.isFirstPlace,
        });
      } catch (error) {
        console.error('[HomeScreen] Error:', error);
        setUiState('error');
        setMessage(error instanceof Error ? error.message : 'Unexpected error');
      } finally {
        setRefreshing(false);
      }
    },
    [syncStepsToSupabase, calculateLeaderboardStatus, goal]
  );

  useFocusEffect(
    React.useCallback(() => {
      const init = async () => {
        // Only run the full init on actual mount or if explicitly requested
        // This prevents the focus effect from looping if state changes
        if (isInitialMount.current) {
          await refreshProfileData();
          await refreshSquads();
          load({ requestPermission: true });
          isInitialMount.current = false;
        }
      };
      init();
    }, [load, refreshProfileData, refreshSquads])
  );

  const handleRefresh = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    load({ requestPermission: false });
  }, [load]);

  const userMetadata = session?.user?.user_metadata;
  const displayName = profile?.display_name || userMetadata?.full_name || 'User';
  const avatarUrl = profile?.avatar_url || userMetadata?.avatar_url || userMetadata?.picture;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      {uiState === 'checking' && (
        <View className="mt-20">
          <LoadingState label="Getting ready..." />
        </View>
      )}

      {uiState === 'ready' && (
        <View className="gap-8">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {formatDate(new Date())}
              </Text>
              <Text className="text-3xl font-black text-foreground">
                Hey {displayName.split(' ')[0]} 👋
              </Text>
            </View>
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 p-1">
              {avatarUrl ? (
                avatarUrl.includes('dicebear.com') || avatarUrl.includes('.svg') ? (
                  <SvgCssUri uri={avatarUrl} width="100%" height="100%" />
                ) : (
                  <Image source={{ uri: avatarUrl }} className="h-full w-full rounded-full" />
                )
              ) : (
                <Text className="text-lg font-black text-primary">{initials}</Text>
              )}
            </View>
          </View>

          <StepCard
            steps={steps}
            goal={goal}
            lastUpdated={lastUpdated}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />

          {/* Squad Quick Access */}
          {mySquads.length > 0 && (
            <View className="gap-4">
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-xl font-black text-foreground">Your Squads</Text>
                <Icon as={Users} size={20} className="text-primary" />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
                {mySquads.map((squad) => (
                  <SquadPreviewCard key={squad.id} squad={squad} userId={session?.user?.id || ''} />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {uiState === 'needsInstall' && (
        <View className="mt-8">
          <ErrorState
            title="Install Health Connect"
            description="Health Connect is required to track your steps."
            primaryActionLabel="Open Play Store"
            onPrimaryAction={() => Linking.openURL(getHealthConnectInstallUrl())}
          />
        </View>
      )}

      {uiState === 'needsPermission' && (
        <View className="mt-8">
          <ErrorState
            title="Permission Required"
            description={message ?? 'We need permission to read your steps.'}
            primaryActionLabel="Grant Permission"
            onPrimaryAction={() => load({ requestPermission: true })}
            secondaryActionLabel="Open Settings"
            onSecondaryAction={openHealthConnectAppSettings}
          />
        </View>
      )}

      {uiState === 'error' && (
        <View className="mt-8">
          <ErrorState
            title="Something went wrong"
            description={message ?? 'Please try again.'}
            primaryActionLabel="Try Again"
            onPrimaryAction={() => load({ requestPermission: false })}
            secondaryActionLabel="Open Settings"
            onSecondaryAction={openHealthConnectAppSettings}
          />
        </View>
      )}
    </ScrollView>
  );
}

function SquadPreviewCard({ squad, userId }: { squad: any; userId: string }) {
  const { members } = useSquadDetails(squad.id);

  const myRank = React.useMemo(() => {
    const index = members.findIndex((m) => m.user_id === userId);
    return index === -1 ? '-' : index + 1;
  }, [members, userId]);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: '/squads', params: { squadId: squad.id } });
      }}
      className="mr-4 w-48 rounded-3xl border border-border bg-card p-5 shadow-sm active:bg-muted">
      <Text className="mb-1 text-sm font-black text-foreground" numberOfLines={1}>
        {squad.name}
      </Text>
      <Text className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Rank in Squad
      </Text>

      <View className="flex-row items-center justify-between">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Text className="text-2xl font-black text-primary">{myRank}</Text>
        </View>
        <View className="items-end">
          <Trophy size={20} className={myRank === 1 ? 'text-yellow-500' : 'text-muted/30'} />
          <Text className="mt-1 text-[8px] font-bold text-muted-foreground">WEEKLY</Text>
        </View>
      </View>
    </Pressable>
  );
}
