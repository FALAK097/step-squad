import { Text } from '@/components/ui/text';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

type Props = {
  label?: string;
};

export function LoadingState({ label = 'Loading Health Connect...' }: Props) {
  return (
    <View className="w-full items-center rounded-2xl border border-border bg-card px-6 py-8">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-center text-base font-medium">{label}</Text>
    </View>
  );
}
