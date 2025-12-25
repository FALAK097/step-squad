import { useAuth } from '@/lib/hooks/useAuth';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { LoadingState } from '@/components/LoadingState';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingState label="Getting ready..." />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
