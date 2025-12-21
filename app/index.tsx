import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { StepCard } from '@/components/StepCard';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  getAvailability,
  getHealthConnectInstallUrl,
  hasStepPermission,
  openHealthConnectAppSettings,
  readTodaySteps,
  requestStepPermission,
  ensureInitialized,
} from '@/lib/health/healthConnect';
import { Stack, useFocusEffect } from 'expo-router';
import { ExternalLink, HeartPulse, ShieldCheck, Smartphone } from 'lucide-react-native';
import * as React from 'react';
import { Linking, ScrollView, View } from 'react-native';

type UiState = 'checking' | 'needsInstall' | 'needsPermission' | 'ready' | 'error';

export default function HomeScreen() {
  const [uiState, setUiState] = React.useState<UiState>('checking');
  const [steps, setSteps] = React.useState<number>(0);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(
    async (options: { requestPermission: boolean }) => {
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
    },
    []
  );

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
      setMessage('Unable to open the Play Store link for Health Connect.');
    }
  }, []);

  const handleOpenSettings = React.useCallback(async () => {
    await openHealthConnectAppSettings();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Step Squad',
          headerTransparent: false,
          headerShadowVisible: false,
          headerRight: () => (
            <Icon as={HeartPulse} className="text-muted-foreground" size={20} />
          ),
        }}
      />
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View className="gap-3">
          <Text variant="h3" className="text-left">
            Today's progress
          </Text>
          <Text variant="muted" className="leading-6">
            Track your daily steps from Health Connect. Refresh anytime to stay in sync.
          </Text>
        </View>

        {uiState === 'checking' ? <LoadingState label="Checking Health Connect..." /> : null}

        {uiState === 'needsInstall' ? (
          <ErrorState
            title="Install Health Connect"
            description="Health Connect is required to read your steps. Install it from the Play Store, then come back to continue."
            primaryActionLabel="Open Play Store"
            onPrimaryAction={handleOpenInstall}
          />
        ) : null}

        {uiState === 'needsPermission' ? (
          <ErrorState
            title="Allow step access"
            description={message ?? 'We need permission to read your steps from Health Connect.'}
            primaryActionLabel="Grant permission"
            onPrimaryAction={() => load({ requestPermission: true })}
            secondaryActionLabel="Open Health Connect settings"
            onSecondaryAction={handleOpenSettings}
          />
        ) : null}

        {uiState === 'error' ? (
          <ErrorState
            title="Something went wrong"
            description={message ?? 'Please try again or check Health Connect.'}
            primaryActionLabel="Try again"
            onPrimaryAction={() => load({ requestPermission: false })}
            secondaryActionLabel="Open Health Connect settings"
            onSecondaryAction={handleOpenSettings}
          />
        ) : null}

        {uiState === 'ready' ? (
          <>
            <StepCard steps={steps} lastUpdated={lastUpdated} onRefresh={handleRefresh} refreshing={refreshing} />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
