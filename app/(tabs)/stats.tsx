import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useStepGoal } from '@/lib/hooks/useStepGoal';
import { useStepHistory } from '@/lib/hooks/useStepHistory';
import { getStartOfWeek, getEndOfWeek } from '@/lib/utils/date';
import { ChevronLeft, ChevronRight, Clock, Flame, TrendingUp } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Pressable, RefreshControl, ScrollView, View, type DimensionValue } from 'react-native';
import * as Haptics from 'expo-haptics';

type ViewMode = 'week' | 'month';

export default function StatsScreen() {
  const [viewMode, setViewMode] = React.useState<ViewMode>('week');
  const [offset, setOffset] = React.useState(0);
  const { colorScheme } = useColorScheme();
  const { history, loading, refresh } = useStepHistory(viewMode, offset);
  const { goal } = useStepGoal();

  // Default to today's date string (local)
  const todayStr = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  const rangeLabel = React.useMemo(() => {
    if (viewMode === 'week') {
      const now = new Date();
      const target = new Date(now.setDate(now.getDate() + offset * 7));
      const start = getStartOfWeek(target);
      const end = getEndOfWeek(target);

      const startMonth = start.toLocaleDateString('en-IN', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-IN', { month: 'short' });

      if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()}–${end.getDate()}`;
      }
      return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
    } else {
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return target.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
  }, [viewMode, offset]);

  // Disable "Previous" if we reach December 2025
  const isPrevDisabled = React.useMemo(() => {
    const now = new Date();
    if (viewMode === 'month') {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + (offset - 1), 1);
      // December 2025 is month 11 (0-indexed)
      return (
        targetMonth.getFullYear() < 2025 ||
        (targetMonth.getFullYear() === 2025 && targetMonth.getMonth() < 11)
      );
    } else {
      const targetDate = new Date(now.setDate(now.getDate() + (offset - 1) * 7));
      const endOfWeek = getEndOfWeek(targetDate);
      return (
        endOfWeek.getFullYear() < 2025 ||
        (endOfWeek.getFullYear() === 2025 && endOfWeek.getMonth() < 11)
      );
    }
  }, [viewMode, offset]);

  // Disable "Next" if we are at the current period
  const isNextDisabled = offset >= 0;

  const maxSteps = React.useMemo(() => {
    const steps = history.map((h) => h.steps);
    return Math.max(...steps, goal, 1) * 1.2; // 20% headroom
  }, [history, goal]);

  const currentDayData = React.useMemo(() => {
    const fallback = history.find((h) => h.date === todayStr) || history[history.length - 1];
    if (!selectedDay) return fallback;
    return history.find((h) => h.date === selectedDay) || fallback;
  }, [selectedDay, history, todayStr]);

  const totalSteps = history.reduce((acc, curr) => acc + curr.steps, 0);

  const handleDayPress = (date: string) => {
    if (date > todayStr) return; // Not interactable for future dates
    Haptics.selectionAsync();
    setSelectedDay(date);
  };

  const handleOffsetChange = (newOffset: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOffset(newOffset);
    setSelectedDay(null);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      {/* View Mode Switcher */}
      <View className="flex-row gap-2 px-6 pb-2 pt-6">
        <Pressable
          onPress={() => {
            setSelectedDay(null);
            setViewMode('week');
            setOffset(0);
          }}
          className={`rounded-full px-6 py-2.5 ${viewMode === 'week' ? 'bg-primary' : 'bg-muted'}`}>
          <Text
            className={`text-[10px] font-black uppercase tracking-widest ${viewMode === 'week' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
            Week
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setSelectedDay(null);
            setViewMode('month');
            setOffset(0);
          }}
          className={`rounded-full px-6 py-2.5 ${viewMode === 'month' ? 'bg-primary' : 'bg-muted'}`}>
          <Text
            className={`text-[10px] font-black uppercase tracking-widest ${viewMode === 'month' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
            Month
          </Text>
        </Pressable>
      </View>

      {/* Navigation Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <Pressable
          onPress={() => handleOffsetChange(offset - 1)}
          disabled={isPrevDisabled}
          className={`rounded-2xl border border-border bg-card p-3 active:bg-muted ${isPrevDisabled ? 'opacity-20' : ''}`}>
          <Icon as={ChevronLeft} size={20} className="text-foreground" />
        </Pressable>

        <View className="items-center">
          <Text className="text-xl font-black text-foreground">{rangeLabel}</Text>
          <Text className="text-xs font-bold text-muted-foreground">
            {totalSteps.toLocaleString('en-IN')} steps total
          </Text>
        </View>

        <Pressable
          onPress={() => handleOffsetChange(offset + 1)}
          disabled={isNextDisabled}
          className={`rounded-2xl border border-border bg-card p-3 active:bg-muted ${isNextDisabled ? 'opacity-20' : ''}`}>
          <Icon as={ChevronRight} size={20} className="text-foreground" />
        </Pressable>
      </View>

      <View className="p-6">
        {/* Selection Info */}
        <View className="mb-10 items-center rounded-[40px] border border-border bg-card p-10 shadow-sm">
          <Text className="mb-2 text-[10px] font-black uppercase tracking-[3px] text-muted-foreground">
            {currentDayData
              ? new Date(currentDayData.date).toLocaleDateString('en-IN', {
                  weekday: viewMode === 'week' ? 'long' : undefined,
                  day: 'numeric',
                  month: 'short',
                })
              : 'No data'}
          </Text>
          <Text className="text-6xl font-black tracking-tighter text-foreground">
            {currentDayData?.steps.toLocaleString('en-IN') || 0}
          </Text>
          <Text className="mt-1 text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Steps
          </Text>
        </View>

        {/* Chart Area */}
        {viewMode === 'week' ? (
          <View className="mb-12 h-64 flex-row items-end justify-between gap-3 px-2">
            {history.map((day) => {
              const barHeight = `${Math.max((day.steps / maxSteps) * 100, 5)}%` as DimensionValue;
              const isGoalMet = day.steps >= goal;
              const isSelected =
                selectedDay === day.date || (!selectedDay && day.date === todayStr);
              const isFuture = day.date > todayStr;
              const dateLabel = new Date(day.date).toLocaleDateString('en-IN', {
                weekday: 'narrow',
              });

              return (
                <Pressable
                  key={day.date}
                  onPress={() => handleDayPress(day.date)}
                  className="h-full flex-1 items-center gap-2"
                  disabled={isFuture}>
                  <View className="w-full flex-1 items-center justify-end">
                    <View
                      style={{ height: barHeight }}
                      className={`w-full max-w-[36px] rounded-t-xl ${isGoalMet ? 'bg-primary' : 'bg-primary/20'} ${isSelected ? 'opacity-100' : isFuture ? 'opacity-10' : 'opacity-40'}`}
                    />
                  </View>
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full ${isSelected ? 'bg-primary' : ''}`}>
                    <Text
                      className={`text-xs font-black ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                      {dateLabel}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="mb-12">
            <View className="flex-row flex-wrap justify-center gap-2.5">
              {history.map((day) => {
                const intensity = Math.min(day.steps / goal, 1);
                let bgColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                if (intensity >= 1) bgColor = '#10B981';
                else if (intensity > 0.5) bgColor = 'rgba(16, 185, 129, 0.6)';
                else if (intensity > 0) bgColor = 'rgba(16, 185, 129, 0.2)';

                const isSelected = selectedDay === day.date;
                const isFuture = day.date > todayStr;

                return (
                  <Pressable
                    key={day.date}
                    onPress={() => handleDayPress(day.date)}
                    style={{ backgroundColor: bgColor, opacity: isFuture ? 0.2 : 1 }}
                    disabled={isFuture}
                    className={`h-10 w-10 items-center justify-center rounded-xl ${isSelected ? 'border-4 border-primary/30' : ''}`}>
                    <Text
                      className={`text-[10px] font-black ${intensity > 0.5 ? 'text-white' : 'text-foreground'}`}>
                      {new Date(day.date).getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Insights */}
        <View className="gap-8">
          <Text className="mb-2 text-2xl font-black text-foreground">Insights</Text>

          <View className="flex-row items-center gap-6 px-1">
            <Icon as={TrendingUp} className="text-primary" size={24} />
            <View className="flex-1">
              <Text className="text-lg font-black text-foreground">Daily Average</Text>
              <Text className="text-sm font-bold text-muted-foreground">
                {history.length > 0
                  ? Math.round(totalSteps / history.length).toLocaleString('en-IN')
                  : 0}{' '}
                steps per day
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-6 px-1">
            <Icon as={Clock} className="text-primary" size={24} />
            <View className="flex-1">
              <Text className="text-lg font-black text-foreground">Goal Consistency</Text>
              <Text className="text-sm font-bold text-muted-foreground">
                {history.filter((h) => h.steps >= goal).length} of {history.length} days met goal
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-6 px-1">
            <Icon as={Flame} className="text-orange-500" size={24} />
            <View className="flex-1">
              <Text className="text-lg font-black text-foreground">Activity Score</Text>
              <Text className="text-sm font-bold text-muted-foreground">
                {history.length > 0
                  ? Math.round((history.filter((h) => h.steps > 0).length / history.length) * 100)
                  : 0}
                % of the period active
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
