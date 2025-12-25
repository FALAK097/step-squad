import '@/global.css';

import { useAuth } from '@/lib/hooks/useAuth';
import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Redirect, Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Footprints, Settings, TrendingUp } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, View } from 'react-native';

export { ErrorBoundary } from 'expo-router';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const { session, loading } = useAuth();
  const theme = NAV_THEME[colorScheme ?? 'light'];
  const iconColor = colorScheme === 'dark' ? '#fff' : '#000';
  const inactiveColor = colorScheme === 'dark' ? '#666' : '#888';

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If user is not logged in, redirect to auth
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.card,
          },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: iconColor,
          tabBarInactiveTintColor: inactiveColor,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Step Squad',
            tabBarLabel: 'Steps',
            tabBarIcon: ({ focused }) => (
              <Footprints size={22} color={focused ? iconColor : inactiveColor} />
            ),
          }}
        />

        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ focused }) => (
              <TrendingUp size={22} color={focused ? iconColor : inactiveColor} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }) => (
              <Settings size={22} color={focused ? iconColor : inactiveColor} />
            ),
          }}
        />
      </Tabs>
      <PortalHost />
    </ThemeProvider>
  );
}
