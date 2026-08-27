import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Card, ModalHeader, Muted, PrimaryButton, SecondaryButton, Title } from '@/components/app/ui';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

export default function GroupOfferScreen() {
  const router = useRouter();
  const toast = useToast();
  const { draft, updateDraft, commitDraft } = useStore();

  const steps = (draft?.steps ?? []).filter((step) => step.trim().length > 0);
  const [naming, setNaming] = useState(steps.length > 1);
  const [groupName, setGroupName] = useState(draft?.groupName ?? '');

  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (saving) return;
    const label = (naming ? groupName : draft?.name) || 'Kebiasaan baru';
    if (naming) updateDraft({ groupName: groupName.trim() || steps[0] });
    setSaving(true);
    try {
      await commitDraft();
      toast.show(`"${label}" tersimpan.`);
      router.dismissTo('/');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  // A group with more than one step needs a name; the default is pre-filled so
  // the user only has to press continue (PRD §4.2).
  if (naming) {
    return (
      <Screen footer={<PrimaryButton label={saving ? 'Menyimpan…' : 'Simpan grup'} onPress={finish} />}>
        <ModalHeader onClose={() => setNaming(false)} label="Beri nama grup" />
        <Title>Grup ini{'\n'}mau dipanggil apa?</Title>
        <Muted className="mt-3">
          Satu grup = satu pengingat, satu tap harian, satu poin identitas.
        </Muted>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Morning Routine"
          placeholderTextColor="rgb(140,152,144)"
          className="mt-6 rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
        />
        <Card className="mt-4">
          <Muted className="mb-2">Langkah di dalam grup</Muted>
          {steps.map((step, index) => (
            <Text key={step} className="text-sm text-ink">
              {index + 1}. {step}
            </Text>
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View className="gap-2">
          <PrimaryButton
            label="Ya, tambah lagi"
            onPress={() => router.push({ pathname: '/habit/new', params: { append: '1' } })}
          />
          <SecondaryButton label={saving ? 'Menyimpan…' : 'Tidak, selesai'} onPress={finish} />
        </View>
      }
    >
      <ModalHeader onClose={() => router.dismissTo('/')} label="Grup" closeIcon="×" />
      <View className="mt-16 items-center">
        <Text className="text-5xl">➕</Text>
        <Title className="text-center">Tambah kebiasaan lain{'\n'}setelah ini?</Title>
        <Muted className="mt-3 text-center">
          Kalau ya, dia jadi langkah berikutnya di grup yang sama — berbagi satu pengingat dan satu
          tap harian.
        </Muted>
      </View>

      <Card className="mt-8">
        <Muted>Tersimpan</Muted>
        <Text className="mt-1 text-[15px] font-bold text-ink">{draft?.name}</Text>
        <Muted className="mt-1">
          {draft?.startTime} · {draft?.location}
        </Muted>
      </Card>
    </Screen>
  );
}
