import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/utils/date';
import { RefreshCcw } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type Props = {
  steps: number;
  lastUpdated?: Date | string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function StepCard({ steps, lastUpdated, onRefresh, refreshing }: Props) {
  const updatedLabel = React.useMemo(() => {
    if (!lastUpdated) return 'Not updated yet';
    return `Updated at ${formatTime(lastUpdated)}`;
  }, [lastUpdated]);

  return (
    <View className="w-full rounded-2xl border border-border bg-card px-5 py-6 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Text variant="muted" className="text-base">
          Today's steps
        </Text>
        {onRefresh ? (
          <Button
            size="icon"
            variant="ghost"
            accessibilityLabel="Refresh steps"
            onPress={onRefresh}
            disabled={refreshing}
            className="rounded-full">
            <Icon as={RefreshCcw} className="text-muted-foreground" />
          </Button>
        ) : null}
      </View>

      <Text className="mt-3 text-6xl font-extrabold tracking-tight" aria-label="Today's step count">
        {steps.toLocaleString()}
      </Text>

      <Text variant="muted" className="mt-3">
        {updatedLabel}
      </Text>
    </View>
  );
}
