import { cn } from '@/lib/cn';
import { Tabs, useRouter } from 'expo-router';
import { CalendarRange, CirclePlus, Home, Sparkles, User } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICONS = {
  index: Home,
  identity: Sparkles,
  history: CalendarRange,
  profile: User,
} as const;

const LABELS = {
  index: 'Hari ini',
  identity: 'Identitas',
  history: 'Riwayat',
  profile: 'Profil',
} as const;

type TabName = keyof typeof ICONS;

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

function TabBar({ state, navigation }: TabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-hairline bg-surface-card"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-around px-2 pb-1 pt-2">
        {state.routes.slice(0, 2).map((route, index) => (
          <TabButton
            key={route.key}
            name={route.name as TabName}
            focused={state.index === index}
            onPress={() => navigation.navigate(route.name)}
          />
        ))}

        <Pressable
          onPress={() => router.push('/habit/new')}
          accessibilityRole="button"
          accessibilityLabel="Tambah kebiasaan"
          className="h-12 w-12 items-center justify-center rounded-2xl bg-brand active:opacity-80"
        >
          <CirclePlus size={24} color="#ffffff" />
        </Pressable>

        {state.routes.slice(2).map((route, index) => (
          <TabButton
            key={route.key}
            name={route.name as TabName}
            focused={state.index === index + 2}
            onPress={() => navigation.navigate(route.name)}
          />
        ))}
      </View>
    </View>
  );
}

function TabButton({
  name,
  focused,
  onPress,
}: {
  name: TabName;
  focused: boolean;
  onPress: () => void;
}) {
  const Icon = ICONS[name];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      className="min-w-[64px] items-center gap-1 py-1 active:opacity-70"
    >
      <Icon size={20} color={focused ? 'rgb(47,107,79)' : 'rgb(138,149,142)'} />
      <Text
        className={cn(
          'text-[10px] font-extrabold',
          focused ? 'text-brand' : 'text-ink-muted'
        )}
      >
        {LABELS[name]}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="identity" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
