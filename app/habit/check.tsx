import { Screen } from '@/components/app/screen';
import { Card, Eyebrow, ModalHeader, Muted, PrimaryButton, SecondaryButton, Subtitle } from '@/components/app/ui';
import { checkAmbiguity } from '@/lib/mock-ai';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

export default function AmbiguityCheckScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useStore();
  const steps = (draft?.steps ?? []).filter((step) => step.trim().length > 0);
  const appending = steps.length > 1;
  const subject = appending ? steps[steps.length - 1] : draft?.name ?? '';
  const [answer, setAnswer] = useState('');
  const [resolved, setResolved] = useState(false);

  const result = useMemo(
    () =>
      draft
        ? checkAmbiguity({ ...draft, name: subject })
        : { clear: false, question: 'Belum ada kebiasaan yang diisi.', note: '' },
    [draft, subject]
  );

  const clear = resolved || result.clear;

  return (
    <Screen
      footer={
        clear ? (
          <PrimaryButton
            label={appending ? 'Tambahkan ke grup' : 'Carikan slot terbaik'}
            onPress={() => router.push(appending ? '/habit/group' : '/habit/negotiate')}
          />
        ) : (
          <View className="gap-2">
            <PrimaryButton
              label="Simpan jawaban"
              onPress={() => {
                if (answer.trim().length > 0) {
                  updateDraft(
                    appending
                      ? { steps: [...steps.slice(0, -1), answer.trim()] }
                      : { name: answer.trim(), groupName: answer.trim(), steps: [answer.trim()] }
                  );
                }
                setResolved(true);
              }}
            />
            <SecondaryButton
              label="Lanjut tanpa mengubah"
              onPress={() => setResolved(true)}
            />
          </View>
        )
      }
    >
      <ModalHeader onClose={() => router.back()} label="Cek kejelasan" />

      {clear ? (
        <Card className="mt-10 items-center p-6">
          <Text className="text-4xl">✨</Text>
          <Eyebrow className="mt-3">Sudah jelas</Eyebrow>
          <Subtitle className="mt-2 text-center">&ldquo;{subject}&rdquo;</Subtitle>
          <Muted className="mt-3 text-center">
            {result.note ||
              'Actionable, lokasinya spesifik, dan jamnya masuk akal. Sekarang kita cari celah waktu di rutinitasmu.'}
          </Muted>
        </Card>
      ) : (
        <View className="mt-10">
          <Card className="p-6">
            <Text className="text-4xl">🤔</Text>
            <Eyebrow className="mt-3">Satu pertanyaan saja</Eyebrow>
            <Text className="mt-2 text-[19px] font-bold leading-6 text-ink">{result.question}</Text>
            {result.note ? <Muted className="mt-2">{result.note}</Muted> : null}
          </Card>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            placeholder="Tulis versi yang lebih spesifik"
            placeholderTextColor="rgb(140,152,144)"
            className="mt-4 rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
          />
          <Muted className="mt-3">
            Kamu tetap boleh lanjut tanpa mengubah apa pun — ini cuma satu putaran konfirmasi.
          </Muted>
        </View>
      )}
    </Screen>
  );
}
