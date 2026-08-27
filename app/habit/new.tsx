import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Card, Chip, ModalHeader, Muted, PrimaryButton, Title } from '@/components/app/ui';
import { WEEKDAY_LABELS } from '@/lib/date';
import { SOFT_CAP_BUILDING_GROUPS } from '@/lib/gates';
import { useStore } from '@/lib/store';
import type { Weekday } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export default function NewHabitScreen() {
  const router = useRouter();
  const toast = useToast();
  const { draft, identityTags, addIdentityTag, updateDraft, atSoftCap, buildingCount } = useStore();
  // A second step joins the group that is already being drafted, so it reuses
  // the group's schedule instead of negotiating a new slot (PRD §4.2, §4.3).
  const appending = useLocalSearchParams<{ append?: string }>().append === '1';

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('21:00');
  const [days, setDays] = useState<Weekday[]>([1, 3, 5]);
  const [tagId, setTagId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [capAcknowledged, setCapAcknowledged] = useState(false);

  const toggleDay = (day: Weekday) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const submit = () => {
    if (name.trim().length === 0) {
      toast.show('Isi dulu nama kebiasaannya.');
      return;
    }

    if (appending) {
      updateDraft({ steps: [...(draft?.steps ?? []), name.trim()] });
      router.replace('/habit/check');
      return;
    }

    const [hour, minute] = startTime.split(':').map(Number);
    const endMinutes = (hour * 60 + (minute || 0) + 30) % (24 * 60);
    const endTime = `${`${Math.floor(endMinutes / 60)}`.padStart(2, '0')}:${`${
      endMinutes % 60
    }`.padStart(2, '0')}`;

    updateDraft({
      name: name.trim(),
      location: location.trim(),
      days,
      startTime,
      endTime,
      identityTagId: tagId,
      groupName: name.trim(),
      steps: [name.trim()],
    });
    router.push('/habit/check');
  };

  // PRD §4.8: soft cap is a nudge, never a block.
  if (atSoftCap && !capAcknowledged && !appending) {
    return (
      <Screen
        footer={
          <View className="gap-2">
            <PrimaryButton label="Tetap lanjut" onPress={() => setCapAcknowledged(true)} />
            <Pressable onPress={() => router.back()} className="items-center py-3">
              <Text className="text-[13px] font-bold text-ink-muted">Nanti dulu</Text>
            </Pressable>
          </View>
        }
      >
        <ModalHeader onClose={() => router.back()} label="Fokus dulu" />
        <Title>Kamu lagi bangun{'\n'}{buildingCount} kebiasaan sekaligus.</Title>
        <Muted className="mt-3">
          Fokus ke sedikit biasanya lebih berhasil. Tapi ini cuma pengingat, bukan larangan —
          keputusannya tetap di kamu.
        </Muted>
        <Card className="mt-6">
          <Muted>Batas lunak</Muted>
          <Text className="mt-1 text-[15px] font-bold text-ink">
            {buildingCount} dari {SOFT_CAP_BUILDING_GROUPS} grup aktif
          </Text>
          <Muted className="mt-1">Kebiasaan yang sudah lulus tidak dihitung.</Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen footer={<PrimaryButton label="Cek kejelasannya" onPress={submit} />}>
      <ModalHeader
        onClose={() => router.back()}
        label={appending ? 'Langkah berikutnya' : 'Kebiasaan baru'}
      />
      <Title>
        {appending ? `Langkah setelah\n"${draft?.steps?.[0] ?? ''}"?` : 'Apa yang mau\nkamu latih?'}
      </Title>
      <Muted className="mt-3">
        {appending
          ? 'Langkah ini ikut jadwal dan pengingat grup yang sama — tidak perlu jam sendiri.'
          : 'Tulis spesifik, sampai dirimu besok tahu persis apa yang harus dilakukan.'}
      </Muted>

      <View className="mt-6 gap-4">
        <Field label="Nama kebiasaan">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="mis. Baca 10 halaman"
            placeholderTextColor="rgb(140,152,144)"
            className="rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
          />
        </Field>

        <Field label="Di mana?">
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="mis. Di meja kerja"
            placeholderTextColor="rgb(140,152,144)"
            className="rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
          />
        </Field>

        {appending ? null : (
        <Field label="Hari apa?">
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, index) => (
              <Chip
                key={label}
                label={label}
                selected={days.includes(index as Weekday)}
                onPress={() => toggleDay(index as Weekday)}
              />
            ))}
          </View>
        </Field>
        )}

        {appending ? null : (
        <Field label="Jam mulai">
          <TextInput
            value={startTime}
            onChangeText={setStartTime}
            placeholder="21:00"
            placeholderTextColor="rgb(140,152,144)"
            keyboardType="numbers-and-punctuation"
            className="w-32 rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
          />
        </Field>
        )}

        {appending ? null : (
        <Field label="Kebiasaan ini membantuku jadi orang… (opsional)">
          <View className="flex-row flex-wrap gap-2">
            {identityTags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.label}
                selected={tagId === tag.id}
                onPress={() => setTagId(tagId === tag.id ? null : tag.id)}
              />
            ))}
          </View>
          <View className="mt-2 flex-row gap-2">
            <TextInput
              value={newTag}
              onChangeText={setNewTag}
              placeholder="Buat identitas baru"
              placeholderTextColor="rgb(140,152,144)"
              className="flex-1 rounded-2xl border border-hairline bg-surface-card px-4 py-3 text-sm text-ink"
            />
            <Pressable
              onPress={() => {
                if (newTag.trim().length === 0) return;
                const tag = addIdentityTag(newTag.trim());
                setTagId(tag.id);
                setNewTag('');
              }}
              className="items-center justify-center rounded-2xl bg-brand-soft px-4"
            >
              <Text className="text-sm font-extrabold text-brand">Tambah</Text>
            </Pressable>
          </View>
        </Field>
        )}
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Muted className="mb-2">{label}</Muted>
      {children}
    </View>
  );
}

