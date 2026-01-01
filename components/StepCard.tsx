import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/utils/date';
import { Footprints, RefreshCcw, Trophy } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  steps: number;
  goal?: number;
  lastUpdated?: Date | string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const DEFAULT_GOAL = 10000;
const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.6; // Reduced size to prevent overlap
const STROKE_WIDTH = 16;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = RADIUS * 2 * Math.PI;

export function StepCard({
  steps,
  goal = DEFAULT_GOAL,
  lastUpdated,
  onRefresh,
  refreshing,
}: Props) {
  const { colorScheme } = useColorScheme();
  const progress = Math.min(steps / goal, 1);
  const strokeDashoffset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const updatedLabel = lastUpdated ? formatTime(lastUpdated) : null;
  const isGoalMet = steps >= goal;

  const primaryColor = '#10B981';
  const trackColor = colorScheme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)';

  return (
    <View className="w-full rounded-[40px] border border-border bg-card p-6 shadow-sm">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
          <Icon as={Footprints} className="text-primary" size={14} />
          <Text className="text-[10px] font-black uppercase tracking-widest text-primary">
            Progress
          </Text>
        </View>
        {onRefresh && (
          <Button
            size="icon"
            variant="ghost"
            onPress={onRefresh}
            disabled={refreshing}
            className="h-8 w-8 rounded-full">
            <Icon
              as={RefreshCcw}
              className={refreshing ? 'text-muted-foreground/50' : 'text-muted-foreground'}
              size={16}
            />
          </Button>
        )}
      </View>

      <View className="items-center justify-center py-4">
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke={trackColor}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
          />
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke={primaryColor}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>

        <View className="absolute items-center justify-center">
          <Text className="text-5xl font-black tracking-tighter text-foreground">
            {steps.toLocaleString('en-IN')}
          </Text>
          <Text className="mt-1 text-xs font-bold text-muted-foreground">
            of {goal.toLocaleString('en-IN')} goal
          </Text>
          {isGoalMet && (
            <View className="mt-3 flex-row items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/20 px-2 py-0.5">
              <Icon as={Trophy} size={12} className="text-yellow-600" />
              <Text className="text-[8px] font-black uppercase tracking-widest text-yellow-700">
                Goal Met
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between border-t border-border/40 pt-4">
        <View>
          <Text className="text-2xl font-black text-foreground">
            {(progress * 100).toFixed(0)}
            <Text className="text-base">%</Text>
          </Text>
          <Text className="text-[10px] font-bold uppercase tracking-[2px] text-muted-foreground">
            Daily Target
          </Text>
        </View>

        {updatedLabel && (
          <View className="items-end">
            <Text className="text-xs font-bold text-foreground">{updatedLabel}</Text>
            <Text className="text-[10px] font-bold uppercase tracking-[2px] text-muted-foreground">
              Synced
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
