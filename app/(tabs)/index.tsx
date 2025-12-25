import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { StepCard } from '@/components/StepCard';
import { Text } from '@/components/ui/text';
import {
  ensureInitialized,
  getAvailability,
  getHealthConnectInstallUrl,
  hasStepPermission,
  openHealthConnectAppSettings,
  readTodaySteps,
  requestStepPermission,
} from '@/lib/health/healthConnect';
import { useStepGoal } from '@/lib/hooks/useStepGoal';
import { formatDate } from '@/lib/utils/date';
import { useFocusEffect } from 'expo-router';
import * as React from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';

type UiState = 'checking' | 'needsInstall' | 'needsPermission' | 'ready' | 'error';

export default function HomeScreen() {
  const [uiState, setUiState] = React.useState<UiState>('checking');
  const [steps, setSteps] = React.useState<number>(0);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const { goal } = useStepGoal();

  const load = React.useCallback(async (options: { requestPermission: boolean }) => {
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

      const { totalSteps } = await readTodaySteps();
      setSteps(totalSteps);
      setLastUpdated(new Date());
      setUiState('ready');
    } catch (error) {
      setUiState('error');
      setMessage(error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load({ requestPermission: true });
    }, [load])
  );

  const handleRefresh = React.useCallback(() => load({ requestPermission: false }), [load]);

  const handleOpenInstall = React.useCallback(async () => {
    const url = getHealthConnectInstallUrl();
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      setMessage('Unable to open the Play Store.');
    }
  }, []);

  const handleOpenSettings = React.useCallback(async () => {
    await openHealthConnectAppSettings();
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {uiState === 'checking' && (
        <View className="mt-20">
          <LoadingState label="Loading..." />
        </View>
      )}

      {uiState === 'needsInstall' && (
        <View className="mt-8">
          <ErrorState
            title="Install Health Connect"
            description="Health Connect is required to track your steps."
            primaryActionLabel="Open Play Store"
            onPrimaryAction={handleOpenInstall}
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
            onSecondaryAction={handleOpenSettings}
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
            onSecondaryAction={handleOpenSettings}
          />
        </View>
      )}

      {uiState === 'ready' && (
        <View className="gap-5">
          <Text className="text-2xl font-bold text-foreground">
            {formatDate(new Date())}
          </Text>

          <StepCard
            steps={steps}
            goal={goal}
            lastUpdated={lastUpdated}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        </View>
      )}
    </ScrollView>
  );
}
