import { CheckCircle, Tag } from '@/components/app/ui';
import { describeDays } from '@/lib/date';
import type { HabitGroup, IdentityTag } from '@/lib/types';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export function GroupCard({
  group,
  tag,
  done,
  onToggle,
}: {
  group: HabitGroup;
  tag?: IdentityTag;
  done: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const stepLabel = group.habits.length > 1 ? ` · ${group.habits.length} langkah` : '';

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-[18px] border border-hairline bg-surface-card p-3.5">
      <Pressable
        className="flex-1 active:opacity-70"
        onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
      >
        {tag ? <Tag>{tag.label}</Tag> : <Tag tone="neutral">Tanpa identitas</Tag>}
        <Text className="mt-2 text-sm font-extrabold text-ink">{group.name}</Text>
        <Text className="mt-0.5 text-[13px] text-ink-muted">
          {group.startTime} · {group.location}
          {stepLabel}
        </Text>
        <Text className="mt-0.5 text-[11px] text-ink-muted">{describeDays(group.days)}</Text>
      </Pressable>
      <CheckCircle done={done} onPress={onToggle} />
    </View>
  );
}
