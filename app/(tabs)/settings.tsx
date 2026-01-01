import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openHealthConnectAppSettings } from '@/lib/health/healthConnect';
import { useAuth } from '@/lib/hooks/useAuth';
import { useStepGoal } from '@/lib/hooks/useStepGoal';
import { useProfile } from '@/lib/hooks/useProfile';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  LogOut,
  Moon,
  Target,
  User,
  Check,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  Image,
  Alert,
} from 'react-native';
import { SvgCssUri } from 'react-native-svg/css';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AVATAR_STYLES = [
  { id: 'personas', name: 'Personas' },
  { id: 'adventurer', name: 'Adventurer' },
];

const AVATAR_SEEDS = [
  'Felix',
  'Aneka',
  'Jack',
  'Luna',
  'Milo',
  'Oliver',
  'Zoe',
  'Pepper',
  'Bear',
  'Coco',
  'Daisy',
  'Lucky',
];

function SettingsItem({
  icon: IconComponent,
  label,
  value,
  onPress,
  variant = 'default',
  isLast = false,
}: {
  icon: any;
  label: string;
  value?: string;
  onPress?: () => void;
  variant?: 'default' | 'destructive';
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-4 px-5 py-4 active:bg-accent/50 ${
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
      <View className="overflow-hidden border rounded-2xl border-border/40 bg-card">
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { goal, setGoal, loading: goalLoading } = useStepGoal();
  const { profile, updateProfile, loading: profileLoading, refresh: refreshProfile } = useProfile();
  const { signOut, session } = useAuth();

  const [goalModalVisible, setGoalModalVisible] = React.useState(false);
  const [profileModalVisible, setProfileModalVisible] = React.useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = React.useState(false);

  const [inputValue, setInputValue] = React.useState('');
  const [selectedAvatar, setSelectedAvatar] = React.useState('');
  const [activeStyle, setActiveStyle] = React.useState(AVATAR_STYLES[0].id);
  const [saving, setSaving] = React.useState(false);

  const handleOpenHealthConnect = React.useCallback(async () => {
    await openHealthConnectAppSettings();
  }, []);

  const toggleTheme = React.useCallback(() => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  }, [colorScheme, setColorScheme]);

  const handleEditGoal = React.useCallback(() => {
    setInputValue(String(goal));
    setGoalModalVisible(true);
  }, [goal]);

  const handleSaveGoal = React.useCallback(async () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setSaving(true);
      await setGoal(parsed);
      setSaving(false);
      setGoalModalVisible(false);
    } else {
      Alert.alert('Invalid value', 'Please enter a valid number greater than 0.');
    }
  }, [inputValue, setGoal]);

  const handleEditProfile = React.useCallback(() => {
    setInputValue(profile?.display_name || '');
    setProfileModalVisible(true);
  }, [profile]);

  const handleSaveProfile = React.useCallback(async () => {
    if (!inputValue.trim()) {
      Alert.alert('Invalid value', 'Display name cannot be empty.');
      return;
    }
    setSaving(true);
    const res = await updateProfile({ display_name: inputValue.trim() });
    setSaving(false);
    if (res?.error) {
      Alert.alert('Error', res.error);
    } else {
      setProfileModalVisible(false);
      refreshProfile();
    }
  }, [inputValue, updateProfile, refreshProfile]);

  const handleSaveAvatar = async (url: string) => {
    setSaving(true);
    const res = await updateProfile({ avatar_url: url });
    setSaving(false);
    if (res?.error) {
      Alert.alert('Error', res.error);
    } else {
      setAvatarModalVisible(false);
      refreshProfile();
    }
  };

  const handleSignOut = React.useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  const userMetadata = session?.user?.user_metadata;
  const displayName = profile?.display_name || userMetadata?.full_name || 'User';
  const avatarUrl = profile?.avatar_url || userMetadata?.avatar_url || userMetadata?.picture;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const avatarsForActiveStyle = React.useMemo(() => {
    return AVATAR_SEEDS.map(
      (seed) =>
        `https://api.dicebear.com/9.x/${activeStyle}/svg?seed=${seed}&scale=90&backgroundColor=transparent`
    );
  }, [activeStyle]);

  return (
    <View className="flex-1 bg-background">
      {/* Goal Modal */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGoalModalVisible(false)}>
        <View className="items-center justify-center flex-1 px-6 bg-black/50">
          <View className="w-full max-w-md p-8 border shadow-2xl rounded-3xl border-border bg-card">
            <Text className="mb-2 text-2xl font-bold text-foreground">Daily Goal</Text>
            <Text className="mb-6 text-muted-foreground">
              How many steps do you want to take today?
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="number-pad"
              className="px-6 py-4 mb-8 text-xl font-bold border rounded-2xl border-input bg-background text-foreground"
              autoFocus
              maxLength={7}
            />
            <View className="flex-row justify-end gap-3">
              <Pressable onPress={() => setGoalModalVisible(false)} className="px-6 py-3">
                <Text className="text-base font-bold text-muted-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveGoal}
                disabled={saving}
                className="px-8 py-3 rounded-xl bg-primary">
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-bold text-primary-foreground">Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Modal */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}>
        <View className="items-center justify-center flex-1 px-6 bg-black/50">
          <View className="w-full max-w-md p-8 border shadow-2xl rounded-3xl border-border bg-card">
            <Text className="mb-2 text-2xl font-bold text-foreground">Display Name</Text>
            <Text className="mb-6 text-muted-foreground">
              This will be visible on squad leaderboards.
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              className="px-6 py-4 mb-8 text-lg font-bold border rounded-2xl border-input bg-background text-foreground"
              autoFocus
              maxLength={20}
              placeholder="Your name"
            />
            <View className="flex-row justify-end gap-3">
              <Pressable onPress={() => setProfileModalVisible(false)} className="px-6 py-3">
                <Text className="text-base font-bold text-muted-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                className="px-8 py-3 rounded-xl bg-primary">
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-bold text-primary-foreground">Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar Selection Modal */}
      <Modal
        visible={avatarModalVisible}
        animationType="slide"
        onRequestClose={() => setAvatarModalVisible(false)}>
        <View
          className="flex-1 bg-background"
          style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center justify-between px-6 py-6 border-b border-border bg-card">
            <Pressable onPress={() => setAvatarModalVisible(false)} className="p-2 -ml-2">
              <Icon as={ChevronLeft} size={28} className="text-foreground" />
            </Pressable>
            <Text className="text-xl font-bold text-foreground">Choose Avatar</Text>
            <View className="w-10" />
          </View>

          <View className="py-4 bg-card">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {AVATAR_STYLES.map((style) => (
                <Pressable
                  key={style.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveStyle(style.id);
                  }}
                  className={`rounded-full px-5 py-2 ${activeStyle === style.id ? 'bg-primary' : 'bg-muted'}`}>
                  <Text
                    className={`font-bold ${activeStyle === style.id ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                    {style.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={avatarsForActiveStyle}
            numColumns={3}
            keyExtractor={(item) => item}
            contentContainerStyle={{ padding: 20, gap: 16 }}
            columnWrapperStyle={{ gap: 16 }}
            removeClippedSubviews={true}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedAvatar(item);
                }}
                className={`aspect-square flex-1 items-center justify-center rounded-3xl border-2 bg-card ${selectedAvatar === item ? 'border-primary' : 'border-border'}`}>
                <SvgCssUri uri={item} width="100%" height="100%" />
                {selectedAvatar === item && (
                  <View className="absolute inset-0 items-center justify-center bg-primary/10">
                    <View className="p-1 rounded-full bg-primary">
                      <Icon as={Check} size={16} className="text-primary-foreground" />
                    </View>
                  </View>
                )}
              </Pressable>
            )}
          />

          <View className="p-6 border-t border-border bg-card">
            <Pressable
              onPress={() => handleSaveAvatar(selectedAvatar)}
              disabled={!selectedAvatar || saving}
              className={`items-center rounded-2xl bg-primary p-5 ${!selectedAvatar || saving ? 'opacity-50' : ''}`}>
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-bold text-primary-foreground">Update Avatar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 24, paddingBottom: 60, paddingTop: 0 }}>
        {/* Profile Header */}
        <View className="items-center pt-2 pb-6 mb-8">
          <Pressable
            onPress={() => {
              setSelectedAvatar(avatarUrl || '');
              setAvatarModalVisible(true);
            }}
            className="relative">
            <View className="items-center justify-center mb-5 overflow-hidden rounded-full h-28 w-28">
              {avatarUrl ? (
                avatarUrl.includes('dicebear.com') || avatarUrl.includes('.svg') ? (
                  <SvgCssUri uri={avatarUrl} width="100%" height="100%" />
                ) : (
                  <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                )
              ) : (
                <Text className="text-3xl font-bold text-primary">{initials}</Text>
              )}
            </View>
            <View className="absolute right-0 p-2 border-2 rounded-full bottom-4 border-background bg-primary">
              <Icon as={User} size={16} className="text-primary-foreground" />
            </View>
          </Pressable>
          <Text className="text-2xl font-bold tracking-tight text-center text-foreground">
            {displayName}
          </Text>
          <Text className="text-sm text-center text-muted-foreground">{session?.user?.email}</Text>
        </View>

        {/* Settings Sections */}
        <SettingsSection title="Profile">
          <SettingsItem
            icon={User}
            label="Display Name"
            value={profileLoading ? 'Loading…' : profile?.display_name || 'Not set'}
            onPress={profileLoading ? undefined : handleEditProfile}
          />
          <SettingsItem
            icon={User}
            label="Change Avatar"
            onPress={() => {
              setSelectedAvatar(avatarUrl || '');
              setAvatarModalVisible(true);
            }}
            isLast
          />
        </SettingsSection>

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
    </View>
  );
}
