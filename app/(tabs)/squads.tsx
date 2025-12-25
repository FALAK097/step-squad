import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSquads, useSquadDetails, Squad } from '@/lib/hooks/useSquads';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/utils/supabase';
import {
  ChevronRight,
  Plus,
  Search,
  Users,
  Trophy,
  X,
  Share2,
  MoreVertical,
  LogOut,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  View,
  Alert,
  Image,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SvgCssUri } from 'react-native-svg/css';
import { useLocalSearchParams } from 'expo-router';

export default function SquadsScreen() {
  const { session } = useAuth();
  const { squadId } = useLocalSearchParams<{ squadId: string }>();
  const { mySquads, loading, createSquad, joinSquadWithCode, leaveSquad, deleteSquad, refresh } =
    useSquads();
  const [selectedSquad, setSelectedSquad] = React.useState<Squad | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = React.useState(false);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (squadId && mySquads.length > 0) {
      const squad = mySquads.find((s) => s.id === squadId);
      if (squad) {
        setSelectedSquad(squad);
      }
    }
  }, [squadId, mySquads]);

  const handleCreate = async (name: string, desc: string) => {
    const squad = await createSquad(name, desc);
    if (squad) {
      setSelectedSquad(squad);
      setIsCreateModalOpen(false);
    }
  };

  const handleJoin = async (code: string) => {
    const res = await joinSquadWithCode(code);
    if (res.success) {
      const { data } = await supabase.from('squads').select('*').eq('id', res.squad_id).single();
      if (data) setSelectedSquad(data);
      setIsJoinModalOpen(false);
    }
    return res;
  };

  const shareInvite = async (squad: Squad) => {
    try {
      await Share.share({
        message: `Join my squad "${squad.name}" on Step Squad! Use invite code: ${squad.invite_code}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = (squad: Squad) => {
    const isAdmin = squad.created_by === session?.user?.id;
    if (isAdmin) {
      Alert.alert(
        'Delete Squad',
        'This will permanently delete the squad and all its history. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteSquad(squad.id),
          },
        ]
      );
    } else {
      Alert.alert('Leave Squad', 'Are you sure you want to leave this squad?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => leaveSquad(squad.id),
        },
      ]);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {loading && mySquads.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : selectedSquad ? (
        <SquadDetails
          squad={selectedSquad}
          onClose={() => setSelectedSquad(null)}
          onLeave={leaveSquad}
          onDelete={deleteSquad}
        />
      ) : (
        <FlatList
          data={mySquads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          ListHeaderComponent={
            <View className="mb-6 gap-4">
              <View className="flex-row gap-4">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsCreateModalOpen(true);
                  }}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary p-4 active:opacity-80">
                  <Icon as={Plus} size={20} className="text-primary-foreground" />
                  <Text className="font-bold text-primary-foreground">Create Squad</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsJoinModalOpen(true);
                  }}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 active:bg-muted">
                  <Icon as={Search} size={20} className="text-foreground" />
                  <Text className="font-bold text-foreground">Join Squad</Text>
                </Pressable>
              </View>

              <Text className="mt-4 text-xl font-black text-foreground">My Squads</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedSquad(item);
                }}
                className="flex-row items-center justify-between p-5 active:bg-muted">
                <View className="flex-1 flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon as={Users} size={24} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                      {item.description || 'No description'}
                    </Text>
                  </View>
                </View>
                <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
              </Pressable>
              <View className="flex-row border-t border-border/40 bg-muted/10">
                <Pressable
                  onPress={() => shareInvite(item)}
                  className="flex-1 flex-row items-center justify-center gap-2 py-3 active:bg-muted">
                  <Icon as={Share2} size={14} className="text-primary" />
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    Share
                  </Text>
                </Pressable>
                <View className="w-[1px] bg-border/40" />
                <Pressable
                  onPress={() => handleDelete(item)}
                  className="flex-1 flex-row items-center justify-center gap-2 py-3 active:bg-muted">
                  <Icon
                    as={item.created_by === session?.user?.id ? Trash2 : LogOut}
                    size={14}
                    className="text-destructive"
                  />
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-destructive">
                    {item.created_by === session?.user?.id ? 'Delete' : 'Leave'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View className="mt-10 items-center justify-center py-10">
              <Icon as={Users} size={64} className="mb-4 text-muted-foreground/20" />
              <Text className="text-lg font-medium text-muted-foreground">
                You haven't joined any squads yet.
              </Text>
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Create one to compete with friends or join using an invite code.
              </Text>
            </View>
          }
        />
      )}

      <CreateSquadModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
      />

      <JoinSquadModal
        visible={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={handleJoin}
      />
    </View>
  );
}

function AvatarView({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10">
      {url ? (
        url.includes('dicebear.com') || url.includes('.svg') ? (
          <SvgCssUri uri={url} width="100%" height="100%" />
        ) : (
          <Image source={{ uri: url }} className="h-full w-full" />
        )
      ) : (
        <Text style={{ fontSize: size * 0.4 }} className="font-bold text-primary">
          {initials}
        </Text>
      )}
    </View>
  );
}

function SquadDetails({
  squad,
  onClose,
  onLeave,
  onDelete,
}: {
  squad: Squad;
  onClose: () => void;
  onLeave: (squadId: string) => Promise<void>;
  onDelete: (squadId: string) => Promise<void>;
}) {
  const [timeframe, setTimeframe] = React.useState<'daily' | 'weekly'>('weekly');
  const { members, loading, refresh } = useSquadDetails(squad.id, timeframe);
  const { session } = useAuth();
  const isAdmin = squad.created_by === session?.user?.id;
  const [showOptions, setShowOptions] = React.useState(false);

  React.useEffect(() => {
    refresh();
  }, [timeframe, refresh]);

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `Join my squad "${squad.name}" on Step Squad! Use invite code: ${squad.invite_code}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleLeave = () => {
    Alert.alert('Leave Squad', 'Are you sure you want to leave this squad?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          onLeave(squad.id);
          onClose();
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Squad',
      'This will permanently delete the squad and all its history. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(squad.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border bg-card px-6 py-4">
        <Pressable onPress={onClose} className="-ml-2 p-2">
          <Icon as={X} size={24} className="text-foreground" />
        </Pressable>
        <Text className="flex-1 text-center text-xl font-bold text-foreground" numberOfLines={1}>
          {squad.name}
        </Text>
        <Pressable onPress={() => setShowOptions(true)} className="-mr-2 p-2">
          <Icon as={MoreVertical} size={24} className="text-foreground" />
        </Pressable>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <View className="mb-6 flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-1.5">
              <Icon as={Trophy} size={18} className="text-yellow-500" />
              <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                {timeframe === 'daily' ? 'Daily' : 'Weekly'} Leaderboard
              </Text>
            </View>
            <View className="flex-row gap-1 rounded-xl bg-muted p-1">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTimeframe('daily');
                }}
                className={`rounded-lg px-3 py-1.5 ${timeframe === 'daily' ? 'bg-background shadow-sm' : ''}`}>
                <Text
                  className={`text-[10px] font-black uppercase tracking-tight ${timeframe === 'daily' ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Daily
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTimeframe('weekly');
                }}
                className={`rounded-lg px-3 py-1.5 ${timeframe === 'weekly' ? 'bg-background shadow-sm' : ''}`}>
                <Text
                  className={`text-[10px] font-black uppercase tracking-tight ${timeframe === 'weekly' ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Weekly
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item: member, index }) => (
          <View
            className={`flex-row items-center justify-between p-5 ${index !== members.length - 1 ? 'border-b border-border' : ''} ${member.user_id === session?.user?.id ? 'bg-primary/5' : ''} ${index === 0 ? 'rounded-t-3xl' : ''} ${index === members.length - 1 ? 'rounded-b-3xl' : ''} bg-card`}>
            <View className="flex-row items-center gap-4">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-orange-400' : 'bg-muted'}`}>
                <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
              </View>
              <AvatarView url={member.avatar_url} name={member.display_name} size={40} />
              <View className="flex-shrink">
                <Text className="font-bold text-foreground" numberOfLines={1}>
                  {member.display_name}
                  {member.user_id === session?.user?.id ? ' (You)' : ''}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {member.role === 'admin' ? 'Squad Leader' : 'Member'}
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="font-bold text-primary">{member.total_steps?.toLocaleString()}</Text>
              <Text className="text-[10px] uppercase text-muted-foreground">Steps</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator className="my-10" />
          ) : (
            <View className="my-10 items-center">
              <Text className="text-muted-foreground">No data for this period</Text>
            </View>
          )
        }
      />

      <Modal visible={showOptions} transparent animationType="fade">
        <Pressable onPress={() => setShowOptions(false)} className="flex-1 justify-end bg-black/40">
          <View className="gap-2 rounded-t-3xl bg-background p-6 pb-12">
            <Pressable
              onPress={() => {
                shareInvite();
                setShowOptions(false);
              }}
              className="flex-row items-center gap-4 rounded-2xl p-4 active:bg-muted">
              <Icon as={Share2} size={20} className="text-foreground" />
              <Text className="text-lg font-medium text-foreground">Share Invite</Text>
            </Pressable>

            {isAdmin ? (
              <Pressable
                onPress={() => {
                  handleDelete();
                  setShowOptions(false);
                }}
                className="flex-row items-center gap-4 rounded-2xl p-4 active:bg-muted">
                <Icon as={Trash2} size={20} className="text-destructive" />
                <Text className="text-lg font-medium text-destructive">Delete Squad</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  handleLeave();
                  setShowOptions(false);
                }}
                className="flex-row items-center gap-4 rounded-2xl p-4 active:bg-muted">
                <Icon as={LogOut} size={20} className="text-destructive" />
                <Text className="text-lg font-medium text-destructive">Leave Squad</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowOptions(false)}
              className="mt-4 items-center rounded-2xl bg-muted p-5">
              <Text className="text-lg font-bold text-foreground">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function CreateSquadModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: any;
}) {
  const [name, setName] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name, desc);
    setLoading(false);
    setName('');
    setDesc('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-center bg-black/50 p-6">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full">
          <View className="rounded-3xl bg-background p-8 shadow-2xl">
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Create Squad</Text>
              <Pressable onPress={onClose} className="p-2">
                <Icon as={X} size={24} className="text-foreground" />
              </Pressable>
            </View>

            <View className="gap-4">
              <View>
                <Text className="mb-2 text-sm font-medium text-muted-foreground">Squad Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Morning Walkers"
                  placeholderTextColor="#888"
                  className="rounded-2xl border border-border bg-card p-4 text-foreground"
                  autoCorrect={false}
                />
              </View>

              <View>
                <Text className="mb-2 text-sm font-medium text-muted-foreground">Description</Text>
                <TextInput
                  value={desc}
                  onChangeText={setDesc}
                  placeholder="What is this squad about?"
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={3}
                  className="h-20 rounded-2xl border border-border bg-card p-4 text-foreground"
                  autoCorrect={false}
                />
              </View>

              <Pressable
                onPress={handleCreate}
                disabled={loading || !name.trim()}
                className={`mt-4 items-center rounded-2xl bg-primary p-5 ${loading || !name.trim() ? 'opacity-50' : ''}`}>
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-lg font-bold text-primary-foreground">Launch Squad</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function JoinSquadModal({
  visible,
  onClose,
  onJoin,
}: {
  visible: boolean;
  onClose: () => void;
  onJoin: any;
}) {
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    const res = await onJoin(code.toUpperCase());
    setLoading(false);
    if (res.error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', res.error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCode('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-center bg-black/50 p-6">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full">
          <View className="rounded-3xl bg-background p-8 shadow-2xl">
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Join Squad</Text>
              <Pressable onPress={onClose} className="p-2">
                <Icon as={X} size={24} className="text-foreground" />
              </Pressable>
            </View>

            <View className="gap-4">
              <View>
                <Text className="mb-2 text-sm font-medium text-muted-foreground">Invite Code</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="ENTER CODE"
                  placeholderTextColor="#888"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  className="rounded-2xl border border-border bg-card p-5 text-center text-2xl font-bold tracking-widest text-primary"
                />
              </View>

              <Pressable
                onPress={handleJoin}
                disabled={loading || !code.trim()}
                className={`mt-4 items-center rounded-2xl bg-primary p-5 ${loading || !code.trim() ? 'opacity-50' : ''}`}>
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-lg font-bold text-primary-foreground">Join Now</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
