import { Muted } from '@/components/app/ui';
import { useStore } from '@/lib/store';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * Nothing should render against an empty store while the session and first
 * snapshot load — an empty tracker and a loading tracker look identical, and
 * one of them is a lie.
 */
export function BootGate({ children }: { children: React.ReactNode }) {
  const { ready, error, refresh, groups } = useStore();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  // An error with data already on screen is a failed write, not a failed boot —
  // those surface as toasts, so only a truly empty store blocks here.
  if (error && groups.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-surface px-8">
        <Text className="text-4xl">📡</Text>
        <Text className="text-center text-[17px] font-bold text-ink">
          Tidak bisa terhubung ke server
        </Text>
        <Muted className="text-center">{error}</Muted>
        <Pressable onPress={() => void refresh()} className="rounded-2xl bg-brand px-5 py-3">
          <Text className="text-sm font-extrabold text-white">Coba lagi</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
