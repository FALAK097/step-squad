import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContext {
  steps: number;
  goal: number;
  hasSquadWithOthers: boolean;
  isFirstPlace: boolean;
}

/**
 * Main entry point to setup all notifications.
 * Should be called after onboarding/health connect setup and step sync.
 */
export async function setupNotifications(context?: NotificationContext) {
  const hasPermission = await registerForPushNotificationsAsync();
  if (!hasPermission) return false;

  // 1. Daily Sync Reminder - 8:00 PM (Always scheduled)
  await scheduleDailySyncReminder();

  if (context) {
    // 2. Step Goal Achievement (Immediate)
    await checkAndNotifyStepGoal(context.steps, context.goal);

    // 3. Leaderboard Nudge (Conditional)
    if (context.hasSquadWithOthers && !context.isFirstPlace) {
      await scheduleLeaderboardNudge();
    } else {
      await cancelNotificationsByType('leaderboard-nudge');
    }

    // 4. Daily Achievement (Conditional)
    if (context.hasSquadWithOthers && context.isFirstPlace) {
      await scheduleDailyAchievementReminder();
    } else {
      await cancelNotificationsByType('daily-achievement');
    }
  }

  return true;
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * 1. Daily Sync Reminder - 8:00 PM
 * Primary reminder to ensure steps are synced for the leaderboard.
 */
export async function scheduleDailySyncReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏃 Sync today’s steps',
      body: 'Open Step Squad to update today’s leaderboard',
      data: { type: 'daily-sync' },
    },
    identifier: 'daily-sync',
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

/**
 * 2. Leaderboard Nudge - 9:30 PM
 * Competitive motivation after steps have likely been synced.
 */
export async function scheduleLeaderboardNudge() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '👀 Your friends are moving ahead',
      body: 'A short walk could change today’s ranking',
      data: { type: 'leaderboard-nudge' },
    },
    identifier: 'leaderboard-nudge',
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 21,
      minute: 30,
    },
  });
}

/**
 * 3. Daily Achievement - 10:30 PM
 * Positive reinforcement at the end of the day.
 */
export async function scheduleDailyAchievementReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🥇 You won today!',
      body: '🎉 Goal smashed — great job!',
      data: { type: 'daily-achievement' },
    },
    identifier: 'daily-achievement',
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 22,
      minute: 30,
    },
  });
}

/**
 * Immediate notification when step goal is reached
 */
async function checkAndNotifyStepGoal(steps: number, goal: number) {
  if (steps < goal) return;

  const today = new Date().toISOString().split('T')[0];
  const lastNotified = await AsyncStorage.getItem('last_goal_notification_date');

  if (lastNotified !== today) {
    await AsyncStorage.setItem('last_goal_notification_date', today);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 Goal Reached!',
        body: `You've hit your daily goal of ${goal.toLocaleString()} steps! Keep it up!`,
        data: { type: 'goal-reached' },
      },
      trigger: null, // Send immediately
    });
  }
}

async function cancelNotificationsByType(type: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === type || notification.identifier === type) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}
