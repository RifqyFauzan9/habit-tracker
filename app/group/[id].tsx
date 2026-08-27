import { Heatmap } from '@/components/app/heatmap';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import {
  Card,
  Divider,
  Eyebrow,
  ModalHeader,
  Muted,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  Subtitle,
  Tag,
} from '@/components/app/ui';
import { describeDays, formatDate, WEEKDAY_LABELS } from '@/lib/date';
import { completionRate, currentStreak, longestStreak } from '@/lib/gates';
import { isRiskyDay, RISKY_LEAD_MINUTES } from '@/lib/reminder-timing';
import { useStore } from '@/lib/store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';

export default function GroupDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const [confirmingEarly, setConfirmingEarly] = useState(false);

  const group = store.groups.find((entry) => entry.id === id);

  if (!group) {
    return (
      <Screen>
        <ModalHeader onClose={() => router.back()} label="Grup" />
        <Muted>Grup ini sudah tidak ada.</Muted>
      </Screen>
    );
  }

  const gates = store.gatesFor(group.id);
  const tag = store.tagFor(group.id);
  // Same rule the scheduler uses, so the copy can never disagree with reality.
  const riskyDays = group.days
    .filter((day) => isRiskyDay(group.id, day, store.logs))
    .map((day) => WEEKDAY_LABELS[day]);
  const rate = completionRate(group, store.logs);
  const mastered = group.status === 'mastered';

  const finishEarly = () => {
    store.markMastered(group.id);
    toast.show(`"${group.name}" jadi bagian tetap harimu.`);
    router.back();
  };

  return (
    <Screen>
      <ModalHeader onClose={() => router.back()} label={mastered ? 'Permanen' : 'Sedang dibentuk'} />

      <Subtitle>{group.name}</Subtitle>
      <Muted className="mt-1">
        {group.startTime}–{group.endTime} · {group.location}
      </Muted>
      <Muted>{describeDays(group.days)}</Muted>
      <View className="mt-3 flex-row gap-2">
        {tag ? <Tag>{tag.label}</Tag> : <Tag tone="neutral">Tanpa identitas</Tag>}
        {mastered ? (
          <Tag>Lulus {group.masteredAt ? formatDate(group.masteredAt) : ''}</Tag>
        ) : (
          <Tag tone="warn">Building</Tag>
        )}
      </View>

      <Card className="mt-5">
        <View className="flex-row items-start justify-between">
          <View>
            <Muted>Streak</Muted>
            <Text className="text-3xl font-black text-ink">
              {currentStreak(group.id, store.logs)}
            </Text>
          </View>
          <View className="items-end">
            <Muted>Terpanjang</Muted>
            <Text className="text-lg font-extrabold text-ink">
              {longestStreak(group.id, store.logs)} hari
            </Text>
          </View>
          <View className="items-end">
            <Muted>30 hari</Muted>
            <Text className="text-lg font-extrabold text-ink">{Math.round(rate * 100)}%</Text>
          </View>
        </View>
        <Divider className="my-3" />
        <Heatmap logs={store.logs} groupId={group.id} weeks={10} />
      </Card>

      <Card className="mt-4">
        <Eyebrow>Langkah</Eyebrow>
        <View className="mt-2 gap-1.5">
          {group.habits.map((habit, index) => (
            <Text key={habit.id} className="text-sm text-ink">
              {index + 1}. {habit.name}
            </Text>
          ))}
        </View>
        <Muted className="mt-3">
          Satu tap menandai seluruh grup — rinciannya cuma buat pengingat.
        </Muted>
      </Card>

      {mastered ? (
        <Card className="mt-4">
          <Eyebrow>Masih jalan?</Eyebrow>
          <Text className="mt-2 text-[15px] font-bold text-ink">
            Kami cek ringan tiap 2–4 minggu.
          </Text>
          <Muted className="mt-1">
            Kalau mulai kendor, aktifkan lagi. Tidak ada label gagal — cuma lanjut dari sini.
          </Muted>
          <SecondaryButton
            label="Aktifkan lagi"
            className="mt-4"
            onPress={() => {
              store.reactivate(group.id);
              toast.show('Dilacak harian lagi. Lanjut dari sini.');
            }}
          />
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <Eyebrow>Progres menuju permanen</Eyebrow>
            <View className="mt-3 gap-3">
              <Gate
                label="Poin identitas"
                current={gates.points.current}
                target={gates.points.target}
                passed={gates.points.passed}
              />
              <Gate
                label="Konsistensi 30 hari"
                current={gates.consistency.current}
                target={gates.consistency.target}
                passed={gates.consistency.passed}
                suffix="%"
              />
              <Gate
                label="Umur kebiasaan"
                current={gates.age.current}
                target={gates.age.target}
                passed={gates.age.passed}
                suffix=" hari"
              />
            </View>
          </Card>

          <Card className="mt-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-ink">Pengingat</Text>
                <Muted>Satu notifikasi menjelang {group.startTime}</Muted>
              </View>
              <Switch
                value={group.reminderEnabled}
                onValueChange={() => store.toggleReminder(group.id)}
                trackColor={{ true: 'rgb(47,107,79)', false: 'rgb(217,225,218)' }}
              />
            </View>
            {group.reminderEnabled && riskyDays.length > 0 ? (
              <>
                <Divider className="my-3" />
                <Muted>
                  {riskyDays.join(' · ')} sering terlewat, jadi pengingatnya dikirim {RISKY_LEAD_MINUTES} menit
                  lebih awal khusus hari itu.
                </Muted>
              </>
            ) : null}
          </Card>

          {confirmingEarly ? (
            <Card className="mt-4 border-warn bg-warn-soft">
              <Eyebrow className="text-warn">Yakin?</Eyebrow>
              <Text className="mt-2 text-[15px] font-bold text-ink">
                Baru jalan {gates.age.current} hari.
              </Text>
              <Muted className="mt-1">
                Biasanya butuh lebih lama buat jadi otomatis. Tapi keputusannya tetap di kamu.
              </Muted>
              <View className="mt-4 flex-row gap-2">
                <SecondaryButton
                  label="Batal"
                  className="flex-1 bg-surface-card"
                  onPress={() => setConfirmingEarly(false)}
                />
                <PrimaryButton label="Tetap lulus" className="flex-1" onPress={finishEarly} />
              </View>
            </Card>
          ) : (
            <SecondaryButton
              label="Tandai sudah otomatis"
              className="mt-4"
              onPress={() => (gates.allPassed ? finishEarly() : setConfirmingEarly(true))}
            />
          )}
        </>
      )}
    </Screen>
  );
}

function Gate({
  label,
  current,
  target,
  passed,
  suffix = '',
}: {
  label: string;
  current: number;
  target: number;
  passed: boolean;
  suffix?: string;
}) {
  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs text-ink-muted">{label}</Text>
        <Text className={`text-xs font-bold ${passed ? 'text-brand' : 'text-ink-muted'}`}>
          {current}
          {suffix} / {target}
          {suffix}
        </Text>
      </View>
      <ProgressBar value={target === 0 ? 0 : current / target} />
    </View>
  );
}
