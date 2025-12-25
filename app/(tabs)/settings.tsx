import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openHealthConnectAppSettings } from '@/lib/health/healthConnect';
import { useAuth } from '@/lib/hooks/useAuth';
import { useStepGoal } from '@/lib/hooks/useStepGoal';
import { ChevronRight, Heart, LogOut, Moon, Target } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Alert, Image, Pressable, ScrollView, View, Modal, TextInput } from 'react-native';
import { Button } from '@/components/ui/button';

function SettingsItem({
  icon: IconComponent,
  label,
  value,
  onPress,
  variant = 'default',
  isLast = false,
}: {
  icon: typeof Heart;
  label: string;
  value?: string;
  onPress?: () => void;
  variant?: 'default' | 'destructive';
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-4 py-4 active:bg-accent/50 ${
        !isLast ? 'border-b border-border/40' : ''
      }`}>
      <View className="items-center justify-center w-5 h-5">
        <Icon
          as={IconComponent}
          className={variant === 'destructive' ? 'text-destructive' : 'text-primary'}
          size={22}
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            variant === 'destructive' ? 'text-destructive' : 'text-foreground'
          }`}>
          {label}
        </Text>
        {value && <Text className="text-sm text-muted-foreground">{value}</Text>}
      </View>
      {onPress && variant !== 'destructive' && (
        <Icon as={ChevronRight} className="text-muted-foreground/30" size={18} />
      )}
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8">
      <Text className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[2px] text-muted-foreground/60">
        {title}
      </Text>
      <View className="px-5 overflow-hidden border rounded-2xl border-border/40 bg-card">
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const { goal, setGoal, loading: goalLoading } = useStepGoal();
  const { signOut, session } = useAuth();

  const [modalVisible, setModalVisible] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const handleOpenHealthConnect = React.useCallback(async () => {
    await openHealthConnectAppSettings();
  }, []);

  const toggleTheme = React.useCallback(() => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  }, [colorScheme, setColorScheme]);

  const handleEditGoal = React.useCallback(() => {
    setInputValue(String(goal));
    setModalVisible(true);
  }, [goal]);

  const handleSaveGoal = React.useCallback(() => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setGoal(parsed);
      setModalVisible(false);
    } else {
      Alert.alert('Invalid value', 'Please enter a valid number greater than 0.');
    }
  }, [inputValue, setGoal]);

  const handleCancelGoal = React.useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleSignOut = React.useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  const userMetadata = session?.user?.user_metadata;
  const fullName = userMetadata?.full_name || 'User';
  const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture;
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelGoal}
      >
        <View className="items-center justify-center flex-1 bg-black/30">
          <View className="w-11/12 max-w-md p-6 border shadow-lg rounded-2xl border-border bg-card">
            <Text className="mb-2 text-lg font-bold text-foreground">Daily Step Goal</Text>
            <Text className="mb-4 text-muted-foreground">Enter your target steps per day</Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="number-pad"
              placeholder="Step goal"
              className="px-4 py-3 mb-6 text-base border rounded-lg border-input bg-background text-foreground"
              autoFocus
              maxLength={7}
              placeholderTextColor="#A3A3A3"
            />
            <View className="flex-row justify-end gap-2">
              <Button variant="ghost" onPress={handleCancelGoal} className="px-4 py-2">
                <Text className="text-base text-muted-foreground">Cancel</Text>
              </Button>
              <Button onPress={handleSaveGoal} className="px-4 py-2">
                <Text className="text-base font-bold text-primary-foreground">Save</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
      <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
      {/* Profile Header */}
      <View className="items-center py-6 mb-10">
        <View className="items-center justify-center w-24 h-24 mb-5 overflow-hidden rounded-full shadow-sm bg-primary/10">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className="w-full h-full" />
          ) : (
            <Text className="text-2xl font-bold text-primary">{initials}</Text>
          )}
        </View>
        <Text className="text-2xl font-bold tracking-tight text-foreground">{fullName}</Text>
        <Text className="text-sm text-muted-foreground">{session?.user?.email}</Text>
      </View>

      {/* Settings Sections */}
      <SettingsSection title="Health & Goals">
        <SettingsItem
          icon={Target}
          label="Daily Goal"
          value={goalLoading ? 'Loading…' : `${goal.toLocaleString('en-IN')} steps`}
          onPress={goalLoading ? undefined : handleEditGoal}
        />
        <SettingsItem
          icon={Heart}
          label="Health Connect"
          value="Manage permissions"
          onPress={handleOpenHealthConnect}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Preferences">
        <SettingsItem
          icon={Moon}
          label="Dark Mode"
          value={colorScheme === 'dark' ? 'Enabled' : 'Disabled'}
          onPress={toggleTheme}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsItem
          icon={LogOut}
          label="Sign Out"
          onPress={handleSignOut}
          variant="destructive"
          isLast
        />
      </SettingsSection>
    </ScrollView>
    </>
  );
}
