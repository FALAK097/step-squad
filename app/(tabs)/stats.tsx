import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { BarChart3, Clock, TrendingUp } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function StatsScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <View className="items-center justify-center py-16">
        <Icon as={TrendingUp} className="mb-4 text-muted-foreground" size={48} />
        <Text className="text-xl font-semibold text-foreground">Coming Soon</Text>
        <Text className="mt-2 text-center text-muted-foreground leading-relaxed">
          Weekly and monthly step trends{'\n'}will appear here.
        </Text>
      </View>

      <View className="gap-4">
        <Text className="text-lg font-semibold text-foreground">Planned Features</Text>
        
        <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Icon as={BarChart3} className="text-primary" size={20} />
          <View className="flex-1">
            <Text className="font-medium text-foreground">Weekly Overview</Text>
            <Text className="text-sm text-muted-foreground">7-day step chart</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Icon as={Clock} className="text-primary" size={20} />
          <View className="flex-1">
            <Text className="font-medium text-foreground">Streaks</Text>
            <Text className="text-sm text-muted-foreground">Track your consistency</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
