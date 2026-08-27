import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Chip, Eyebrow, Muted, PrimaryButton, SecondaryButton, StepDots, Title } from '@/components/app/ui';
import { ONBOARDING_BLOCKS } from '@/lib/mock-data';
import { useStore } from '@/lib/store';
import type { RoutineBlock } from '@/lib/types';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const BLOCK_TIMES: Record<string, { start: string; end: string; label: string }> = {
  wake: { start: '06:00', end: '09:00', label: 'Bangun & siap-siap' },
  morning: { start: '09:00', end: '12:00', label: 'Pagi menjelang siang' },
  afternoon: { start: '12:00', end: '18:00', label: 'Siang–sore' },
  evening: { start: '18:00', end: '21:00', label: 'Malam' },
  bedtime: { start: '21:00', end: '22:30', label: 'Sebelum tidur' },
};

export default function OnboardingScreen() {
  const router = useRouter();
  const toast = useToast();
  const { finishOnboarding } = useStore();

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState('');

  const block = ONBOARDING_BLOCKS[step];
  const selected = picked[block.id] ?? [];
  const isLast = step === ONBOARDING_BLOCKS.length - 1;

  const toggle = (option: string) => {
    setPicked((prev) => {
      const current = prev[block.id] ?? [];
      return {
        ...prev,
        [block.id]: current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option],
      };
    });
  };

  const advance = () => {
    if (custom.trim().length > 0) {
      toggle(custom.trim());
      setCustom('');
    }
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    const blocks: RoutineBlock[] = ONBOARDING_BLOCKS.filter(
      (entry) => (picked[entry.id] ?? []).length > 0
    ).map((entry) => ({
      id: `rb-${entry.id}`,
      label: (picked[entry.id] ?? []).join(' · '),
      startTime: BLOCK_TIMES[entry.id].start,
      endTime: BLOCK_TIMES[entry.id].end,
      source: 'onboarding' as const,
    }));
    finishOnboarding(blocks);
    toast.show('Rutinitas terpetakan. Bisa diubah kapan saja di Profil.');
    router.dismissTo('/');
  };

  return (
    <Screen
      footer={
        <View className="flex-row gap-2">
          <SecondaryButton
            label="Lewati"
            className="w-1/3"
            onPress={() => (isLast ? advance() : setStep(step + 1))}
          />
          <PrimaryButton
            label={isLast ? 'Selesai' : 'Lanjut'}
            className="flex-1"
            onPress={advance}
          />
        </View>
      }
    >
      <View className="mb-6 flex-row items-center justify-between">
        <Pressable
          onPress={() => (step === 0 ? router.back() : setStep(step - 1))}
          hitSlop={10}
          className="h-9 w-9 items-center justify-center"
        >
          <Text className="text-xl text-ink">{step === 0 ? '×' : '‹'}</Text>
        </Pressable>
        <StepDots total={ONBOARDING_BLOCKS.length} current={step} />
        <Text className="text-xs font-bold text-ink-muted">
          {step + 1}/{ONBOARDING_BLOCKS.length}
        </Text>
      </View>

      <Eyebrow>{block.eyebrow}</Eyebrow>
      <Title>{block.title}</Title>
      {step === 0 ? (
        <Muted className="mt-3">
          Biar kami tahu harimu seperti apa, dan bisa menaruh kebiasaan baru di waktu yang pas.
        </Muted>
      ) : (
        <Muted className="mt-3">Pilih yang besar-besar saja, bukan tiap menit.</Muted>
      )}

      <View className="mt-6 flex-row flex-wrap gap-2">
        {block.options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={selected.includes(option)}
            onPress={() => toggle(option)}
          />
        ))}
      </View>

      <View className="mt-5">
        <Muted className="mb-2">Lainnya</Muted>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          placeholder="Tulis kegiatan lain di blok ini"
          placeholderTextColor="rgb(140,152,144)"
          className="rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
        />
      </View>

      {selected.length > 0 ? (
        <View className="mt-5 rounded-2xl border border-hairline bg-surface-card p-4">
          <Muted>Blok ini akan tersimpan sebagai</Muted>
          <Text className="mt-1 text-sm font-bold text-ink">{selected.join(' · ')}</Text>
          <Text className="mt-0.5 text-xs text-ink-muted">
            {BLOCK_TIMES[block.id].start}–{BLOCK_TIMES[block.id].end}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
