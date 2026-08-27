import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Card, Divider, Eyebrow, Muted, SectionHead, Subtitle } from '@/components/app/ui';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { routineBlocks, groups, finance, toggleReminder } = useStore();

  const mastered = groups.filter((group) => group.status === 'mastered');
  const remindersOn = groups.some((group) => group.reminderEnabled);

  return (
    <Screen>
      <View className="mb-5 flex-row items-center justify-between">
        <View>
          <Eyebrow>Profil</Eyebrow>
          <Subtitle className="mt-1">Rifqy</Subtitle>
        </View>
        <View className="h-12 w-12 items-center justify-center rounded-[18px] bg-brand">
          <Text className="text-sm font-black text-white">RF</Text>
        </View>
      </View>

      <View className="gap-3">
        <Row
          title="Peta rutinitas"
          subtitle={`${routineBlocks.length} blok · bisa diedit kapan saja`}
          action="Edit"
          onPress={() => router.push('/onboarding')}
        />

        <Card className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-ink">Notifikasi</Text>
            <Muted>Satu pengingat per grup, bukan per langkah</Muted>
          </View>
          <Switch
            value={remindersOn}
            onValueChange={() => {
              groups
                .filter((group) => group.status === 'building')
                .forEach((group) => toggleReminder(group.id));
              toast.show(remindersOn ? 'Pengingat dimatikan.' : 'Pengingat dinyalakan.');
            }}
            trackColor={{ true: 'rgb(47,107,79)', false: 'rgb(217,225,218)' }}
          />
        </Card>

        <Row
          title="Dana keinginan"
          subtitle={
            finance.enabled
              ? `Manual · ${finance.incrementPercent}% per penyelesaian`
              : 'Belum aktif · sepenuhnya manual'
          }
          action="Buka"
          onPress={() => router.push('/finance')}
        />

        <Card>
          <Text className="text-[15px] font-bold text-ink">Kebiasaan permanen</Text>
          <Muted>{mastered.length} rutinitas tetap</Muted>
          {mastered.length > 0 ? (
            <View className="mt-3">
              {mastered.map((group, index) => (
                <View key={group.id}>
                  {index > 0 ? <Divider className="my-2.5" /> : null}
                  <Pressable
                    onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
                    className="flex-row items-center justify-between"
                  >
                    <Text className="text-sm text-ink">{group.name}</Text>
                    <Text className="text-xs font-bold text-brand">Lihat</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </View>

      <View className="mt-6">
        <SectionHead title="Peta rutinitasmu" />
        <Card>
          {routineBlocks.map((block, index) => (
            <View key={block.id}>
              {index > 0 ? <Divider className="my-3" /> : null}
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink">{block.label}</Text>
                  {block.source === 'mastered_group' ? (
                    <Muted>Dari kebiasaan yang sudah lulus</Muted>
                  ) : null}
                </View>
                <Text className="text-xs font-bold text-ink-muted">
                  {block.startTime}–{block.endTime}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View className="mt-6">
        <Eyebrow>Prinsip desain</Eyebrow>
        <Text className="mt-2 text-[17px] font-extrabold leading-6 text-ink">
          &ldquo;Tracker itu sementara. Identitasnya yang tinggal.&rdquo;
        </Text>
      </View>
    </Screen>
  );
}

function Row({
  title,
  subtitle,
  action,
  onPress,
}: {
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      <Card className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-ink">{title}</Text>
          <Muted>{subtitle}</Muted>
        </View>
        <Text className="text-xs font-extrabold text-brand">{action}</Text>
      </Card>
    </Pressable>
  );
}
