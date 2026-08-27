import { GroupCard } from '@/components/app/group-card';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Card, Eyebrow, Muted, PrimaryButton, SecondaryButton, SectionHead, Title } from '@/components/app/ui';
import { formatDayHeader } from '@/lib/date';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function TodayScreen() {
  const router = useRouter();
  const toast = useToast();
  const store = useStore();
  const { todayGroups, statusFor, tagFor, toggleToday, identityTags, groups, gatesFor } = store;

  const doneCount = todayGroups.filter((group) => statusFor(group.id) === 'done').length;
  const progress = todayGroups.length === 0 ? 0 : doneCount / todayGroups.length;

  const topTag = useMemo(
    () => identityTags.slice().sort((a, b) => b.points - a.points)[0],
    [identityTags]
  );

  // PRD §4.8: the mastery offer appears when all three gates pass, and only
  // re-appears on a later evaluation after the user declines it.
  const masteryCandidate = useMemo(
    () =>
      groups.find(
        (group) =>
          group.status === 'building' &&
          !group.masteryOfferDeclinedAt &&
          gatesFor(group.id).allPassed
      ),
    [groups, gatesFor]
  );

  const handleToggle = (groupId: string) => {
    const wasDone = statusFor(groupId) === 'done';
    toggleToday(groupId);
    if (wasDone) return;
    const remaining = todayGroups.length - doneCount - 1;
    toast.show(
      remaining === 0
        ? 'Selesai semua. Satu suara lagi untuk dirimu yang baru.'
        : 'Tercatat. Yang penting jangan bolong dua hari berturut-turut.'
    );
  };

  return (
    <Screen>
      <View className="mb-5 flex-row items-start justify-between">
        <View className="flex-1">
          <Eyebrow>{formatDayHeader()}</Eyebrow>
          <Title>Bangun dirimu{'\n'}satu tap sehari.</Title>
        </View>
        <Pressable
          onPress={() => router.push('/profile')}
          className="h-10 w-10 items-center justify-center rounded-[13px] border border-hairline bg-surface-card"
        >
          <Text className="text-xs font-black text-brand">RF</Text>
        </Pressable>
      </View>

      <View className="overflow-hidden rounded-[26px] bg-brand p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[13px] text-white/75">Progres hari ini</Text>
            <Text className="text-[46px] font-black tracking-tighter text-white">
              {doneCount}/{todayGroups.length}
            </Text>
          </View>
          <Text className="text-4xl">🌱</Text>
        </View>
        <View className="mt-3 h-[7px] overflow-hidden rounded-full bg-white/25">
          <View className="h-full rounded-full bg-lime" style={{ width: `${progress * 100}%` }} />
        </View>
        <Text className="mt-2.5 text-[13px] text-white/80">
          Kebiasaan kecil menumpuk jadi identitas.
        </Text>
      </View>

      {masteryCandidate ? (
        <Card className="mt-5 border-brand bg-brand-soft">
          <Eyebrow>Kayaknya sudah otomatis</Eyebrow>
          <Text className="mt-2 text-[15px] font-bold text-ink">
            &ldquo;{masteryCandidate.name}&rdquo; sudah jalan konsisten. Berhenti dilacak harian?
          </Text>
          <Muted className="mt-1">
            Riwayat dan poinmu tetap tersimpan. Bisa diaktifkan lagi kapan saja.
          </Muted>
          <View className="mt-4 flex-row gap-2">
            <SecondaryButton
              label="Belum"
              className="flex-1 bg-surface-card"
              onPress={() => {
                store.declineMastery(masteryCandidate.id);
                toast.show('Oke, kita tanya lagi nanti.');
              }}
            />
            <PrimaryButton
              label="Ya, lulus"
              className="flex-1"
              onPress={() => {
                store.markMastered(masteryCandidate.id);
                toast.show(`"${masteryCandidate.name}" jadi bagian tetap harimu.`);
              }}
            />
          </View>
        </Card>
      ) : null}

      <View className="mt-6">
        <SectionHead title="Hari ini" action="Lihat riwayat" onAction={() => router.push('/history')} />
        {todayGroups.length === 0 ? (
          <Card>
            <Text className="text-[15px] font-bold text-ink">Belum ada yang dijadwalkan.</Text>
            <Muted className="mt-1">
              Tambah satu kebiasaan, dan kami carikan celah waktu yang realistis.
            </Muted>
            <PrimaryButton
              label="Tambah kebiasaan"
              className="mt-4"
              onPress={() => router.push('/habit/new')}
            />
          </Card>
        ) : (
          <View className="gap-3">
            {todayGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                tag={tagFor(group.id)}
                done={statusFor(group.id) === 'done'}
                onToggle={() => handleToggle(group.id)}
              />
            ))}
          </View>
        )}
      </View>

      {topTag ? (
        <View className="mt-6">
          <SectionHead title="Identitasmu" action="Lihat refleksi" onAction={() => router.push('/identity')} />
          <Card className="flex-row items-center justify-between">
            <View>
              <Muted>Kamu sudah memilih jadi orang</Muted>
              <Text className="text-[17px] font-extrabold text-ink">{topTag.label}</Text>
              <Muted>{topTag.points} kali</Muted>
            </View>
            <Text className="text-[46px] font-black tracking-tighter text-brand">
              {topTag.points}
            </Text>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
