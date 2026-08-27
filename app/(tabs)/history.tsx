import { Heatmap } from '@/components/app/heatmap';
import { Screen } from '@/components/app/screen';
import { BigNumber, Card, Divider, Eyebrow, Muted, SectionHead, Subtitle, Tag } from '@/components/app/ui';
import { completionRate, currentStreak, longestStreak } from '@/lib/gates';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export default function HistoryScreen() {
  const router = useRouter();
  const { groups, logs } = useStore();

  const overallStreak = Math.max(0, ...groups.map((group) => currentStreak(group.id, logs)));
  const overallLongest = Math.max(0, ...groups.map((group) => longestStreak(group.id, logs)));
  const monthlyRate =
    groups.length === 0
      ? 0
      : groups.reduce((sum, group) => sum + completionRate(group, logs), 0) / groups.length;

  return (
    <Screen>
      <View className="mb-5">
        <Eyebrow>Konsistensi</Eyebrow>
        <Subtitle className="mt-1">Jejak perjalananmu</Subtitle>
      </View>

      <Card>
        <View className="flex-row items-start justify-between">
          <View>
            <Muted>Streak berjalan</Muted>
            <BigNumber>{overallStreak}</BigNumber>
          </View>
          <View className="items-end">
            <Muted>Terpanjang</Muted>
            <Text className="text-xl font-extrabold text-ink">{overallLongest} hari</Text>
          </View>
        </View>
        <Divider className="my-3" />
        <Muted className="mb-3">Konsistensi 30 hari · {Math.round(monthlyRate * 100)}%</Muted>
        <Heatmap logs={logs} />
      </Card>

      <View className="mt-6">
        <SectionHead title="Per grup" />
        <View className="gap-3">
          {groups.map((group) => (
            <Pressable
              key={group.id}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-ink">{group.name}</Text>
                    <View className="mt-1.5">
                      {group.status === 'mastered' ? (
                        <Tag>Permanen · riwayat saja</Tag>
                      ) : (
                        <Tag tone="warn">Sedang dibentuk</Tag>
                      )}
                    </View>
                  </View>
                  <Text className="text-lg font-extrabold text-ink">
                    {Math.round(completionRate(group, logs) * 100)}%
                  </Text>
                </View>
                <View className="mt-3">
                  <Heatmap logs={logs} groupId={group.id} weeks={8} />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
