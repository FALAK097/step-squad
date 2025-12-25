import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/utils/date';
import { Footprints, RefreshCcw } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type Props = {
  steps: number;
  goal?: number;
  lastUpdated?: Date | string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const DEFAULT_GOAL = 10000;

export function StepCard({ steps, goal = DEFAULT_GOAL, lastUpdated, onRefresh, refreshing }: Props) {
  const progress = Math.min((steps / goal) * 100, 100);
  const updatedLabel = lastUpdated ? formatTime(lastUpdated) : null;

  return (
    <View className="w-full rounded-3xl border border-border bg-card p-6">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon as={Footprints} className="text-primary" size={20} />
          <Text className="text-base font-medium text-muted-foreground">Today</Text>
        </View>
        {onRefresh && (
          <Button
            size="icon"
            variant="ghost"
            accessibilityLabel="Refresh steps"
            onPress={onRefresh}
            disabled={refreshing}
            className="rounded-full"
          >
            <Icon as={RefreshCcw} className={refreshing ? 'text-muted-foreground/50' : 'text-muted-foreground'} size={18} />
          </Button>
        )}
      </View>

      <View className="mt-6 items-center">
        <Text className="text-7xl font-bold tracking-tight text-foreground">
          {steps.toLocaleString('en-IN')}
        </Text>
        <Text className="mt-1 text-base text-muted-foreground">
          / {goal.toLocaleString('en-IN')} goal
        </Text>
      </View>

      <View className="mt-6">
        <View className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">
            {progress.toFixed(0)}% of daily goal
          </Text>
          {updatedLabel && (
            <Text className="text-sm text-muted-foreground">
              {updatedLabel}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
