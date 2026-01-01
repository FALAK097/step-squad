import { Text } from '@/components/ui/text';
import * as React from 'react';
import { ActivityIndicator, View, Image } from 'react-native';

type Props = {
  label?: string;
};

export function LoadingState({ label = 'Loading Health Connect...' }: Props) {
  return (
    <View className="w-full items-center rounded-[40px] border border-border bg-card px-6 py-10 shadow-sm">
      <View className="mb-6 h-24 w-24 items-center justify-center rounded-[32px] bg-primary/10 p-4">
        <Image
          source={require('@/assets/images/onboarding-1.png')}
          className="h-full w-full"
          resizeMode="contain"
        />
      </View>
      <ActivityIndicator size="small" color="#10B981" />
      <Text className="mt-4 text-center text-sm font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}
