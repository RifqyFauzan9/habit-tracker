import { Screen } from '@/components/app/screen';
import { Card, Divider, Eyebrow, ModalHeader, Muted, PrimaryButton, SecondaryButton, Tag, Title } from '@/components/app/ui';
import { requestSlot, type SlotSuggestion } from '@/lib/api';
import { describeDays } from '@/lib/date';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

export default function NegotiateScreen() {
  const router = useRouter();
  const { draft, identityTags, updateDraft } = useStore();

  const [sessionId, setSessionId] = useState<string | undefined>();
  const [suggestion, setSuggestion] = useState<SlotSuggestion | null>(null);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(3);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [rejected, setRejected] = useState<{ time: string; reason: string }[]>([]);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [manualTime, setManualTime] = useState(draft?.startTime ?? '21:00');

  // The rejection history lives server-side in the negotiation session, so the
  // model sees every round — not just the last one (PRD §4.3).
  const ask = useCallback(
    async (rejectionReason?: string) => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await requestSlot({
          sessionId,
          draft: sessionId
            ? undefined
            : {
                nama: draft?.name,
                lokasi: draft?.location,
                hari: draft?.days,
                durasi_menit: 30,
                jam_diinginkan: draft?.startTime,
              },
          rejectionReason,
        });
        setSessionId(result.sessionId);
        setRound(result.round);
        setMaxRounds(result.maxRounds);
        setExhausted(result.exhausted);
        setSuggestion(result.suggestion);
      } catch {
        // §4.3's escape hatch is the same one used when rounds run out: hand
        // the clock to the user rather than trapping them in a broken loop.
        setFailed(true);
        setExhausted(true);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, draft]
  );

  useEffect(() => {
    void ask();
    // Only on mount: later rounds are triggered by the user rejecting a slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tag = identityTags.find((entry) => entry.id === draft?.identityTagId);

  const accept = (startTime: string, endTime?: string) => {
    updateDraft({ startTime, ...(endTime ? { endTime } : {}) });
    router.push('/habit/group');
  };

  if (loading) {
    return (
      <Screen>
        <ModalHeader onClose={() => router.back()} label="Cari celah waktu" />
        <View className="mt-24 items-center">
          <ActivityIndicator />
          <Muted className="mt-4">Membaca peta rutinitasmu…</Muted>
        </View>
      </Screen>
    );
  }

  // PRD §4.3: after three rounds stop negotiating and hand the clock over.
  if (exhausted || !suggestion) {
    return (
      <Screen footer={<PrimaryButton label="Simpan jadwalku" onPress={() => accept(manualTime)} />}>
        <ModalHeader onClose={() => router.back()} label="Jadwalmu sendiri" />
        <Title>Kamu yang pilih{'\n'}jamnya.</Title>
        <Muted className="mt-3">
          {failed
            ? 'Usulan otomatis lagi tidak bisa dipakai. Tentukan sendiri saja — tidak ada yang hilang.'
            : `Sudah ${maxRounds} usulan. Tidak perlu berdebat lebih lama — tentukan sendiri saja.`}
        </Muted>
        <View className="mt-6 gap-3">
          <TextInput
            value={manualTime}
            onChangeText={setManualTime}
            placeholder="20:30"
            placeholderTextColor="rgb(140,152,144)"
            keyboardType="numbers-and-punctuation"
            className="w-32 rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
          />
          <Card>
            <Muted>Kebiasaan</Muted>
            <Text className="mt-1 text-[15px] font-bold text-ink">{draft?.name}</Text>
            <Divider className="my-3" />
            <Muted>{describeDays(draft?.days ?? [])} · {draft?.location}</Muted>
          </Card>
        </View>
      </Screen>
    );
  }

  if (asking) {
    return (
      <Screen
        footer={
          <PrimaryButton
            label="Coba slot lain"
            onPress={() => {
              setRejected((prev) => [...prev, { time: suggestion.startTime, reason: reason.trim() }]);
              const submitted = reason.trim();
              setReason('');
              setAsking(false);
              void ask(submitted);
            }}
          />
        }
      >
        <ModalHeader
          onClose={() => setAsking(false)}
          label="Apa yang kurang pas?"
          right={<Text className="text-xs font-bold text-ink-muted">{round}/{maxRounds}</Text>}
        />
        <Title>Bilang saja apa{'\n'}yang tidak cocok.</Title>
        <Muted className="mt-3">
          Satu alasan singkat cukup. Usulan berikutnya tidak akan mirip yang ini.
        </Muted>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          placeholder="mis. jam segitu anak-anak masih berisik"
          placeholderTextColor="rgb(140,152,144)"
          className="mt-5 h-28 rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 text-[15px] text-ink"
          textAlignVertical="top"
        />
        <Card className="mt-4">
          <Muted>Usulan sebelumnya</Muted>
          <Text className="mt-1 text-[15px] font-bold text-ink">
            {suggestion.startTime} · {draft?.location}
          </Text>
          <Muted className="mt-1">Penolakan ini akan diingat sepanjang sesi.</Muted>
        </Card>
        {rejected.length > 0 ? (
          <View className="mt-4">
            <Muted className="mb-2">Sudah ditolak</Muted>
            <View className="gap-2">
              {rejected.map((entry) => (
                <Card key={`${entry.time}-${entry.reason}`} className="py-3">
                  <Text className="text-sm font-bold text-ink">{entry.time}</Text>
                  {entry.reason ? <Muted>{entry.reason}</Muted> : null}
                </Card>
              ))}
            </View>
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View className="flex-row gap-2">
          <SecondaryButton label="Ganti" className="w-1/3" onPress={() => setAsking(true)} />
          <PrimaryButton
            label="Oke"
            className="flex-1"
            onPress={() => accept(suggestion.startTime, suggestion.endTime)}
          />
        </View>
      }
    >
      <ModalHeader
        onClose={() => router.back()}
        label="Cari celah waktu"
        right={<Text className="text-xs font-bold text-ink-muted">{round}/{maxRounds}</Text>}
      />
      <Eyebrow>{round === 1 ? 'Slot yang cocok' : 'Bagaimana kalau ini?'}</Eyebrow>
      <Title>{suggestion.startTime} —{'\n'}{suggestion.anchor.toLowerCase()}.</Title>
      <Muted className="mt-3">{suggestion.reason}</Muted>

      <Card className="mt-6">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-ink">{draft?.name}</Text>
            <Muted>{describeDays(draft?.days ?? [])}</Muted>
          </View>
          {tag ? <Tag>{tag.label}</Tag> : null}
        </View>
        <Divider className="my-3" />
        <Muted>Kenapa slot ini?</Muted>
        <Text className="mt-1 text-[13px] text-ink">
          Menempel ke rutinitas yang sudah ada, bukan bersaing dengan blok tersibukmu.
        </Text>
      </Card>

      {rejected.length > 0 ? (
        <Muted className="mt-4">
          {rejected.length} usulan sebelumnya sudah dicoret dan tidak akan diulang.
        </Muted>
      ) : null}
    </Screen>
  );
}
