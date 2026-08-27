import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import {
  BigNumber,
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
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

export default function FinanceScreen() {
  const router = useRouter();
  const toast = useToast();
  const { finance, financeLogs, enableFinance, allocate } = useStore();

  const used = financeLogs.reduce((sum, log) => sum + log.percent, 0);
  const remaining = Math.max(0, finance.totalPercent - used);
  const atCap = remaining < finance.incrementPercent;

  // PRD §4.7: the education screen is mandatory before the feature turns on.
  if (!finance.enabled) {
    return (
      <Screen
        footer={
          <View className="gap-2">
            <PrimaryButton
              label="Saya paham, aktifkan"
              onPress={() => {
                enableFinance();
                toast.show('Dana keinginan aktif. Semua pencatatan manual.');
              }}
            />
            <SecondaryButton label="Nanti dulu" onPress={() => router.back()} />
          </View>
        }
      >
        <ModalHeader onClose={() => router.back()} label="Sebelum mulai" closeIcon="×" />
        <Subtitle>Aplikasi ini tidak pernah{'\n'}menyentuh uangmu.</Subtitle>
        <View className="mt-6 gap-3">
          <Point
            title="Tidak ada koneksi ke rekening"
            body="Tidak ada integrasi bank atau e-wallet. Tidak ada nomor rekening yang disimpan."
          />
          <Point
            title="Kamu yang transfer sendiri"
            body="Kami cuma mengingatkan. Pemindahan dana kamu lakukan di aplikasi bankmu."
          />
          <Point
            title="Yang disimpan cuma persentase"
            body="Bukan nominal, bukan saldo. Jadi datanya tetap tidak bisa dipakai siapa pun."
          />
          <Point
            title="Gagal tidak bikin minus"
            body="Alokasi cuma berhenti bertambah. Tidak ada hukuman, tidak ada saldo negatif."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ModalHeader onClose={() => router.back()} label="Dana keinginan" closeIcon="×" />

      <Card className="border-warn bg-warn-soft">
        <Tag tone="warn">Manual sepenuhnya</Tag>
        <Text className="mt-2 text-[15px] font-bold text-ink">Tidak ada koneksi bank.</Text>
        <Muted className="mt-1">
          Aplikasi tidak pernah memindahkan uang. Kamu transfer sendiri di aplikasi bankmu.
        </Muted>
      </Card>

      <Card className="mt-4">
        <Muted>Jatah bulan ini</Muted>
        <View className="flex-row items-end gap-2">
          <BigNumber>{finance.totalPercent}%</BigNumber>
          <Text className="pb-3 text-[13px] text-ink-muted">dari pemasukan</Text>
        </View>
        <ProgressBar className="mt-3" value={finance.totalPercent === 0 ? 0 : used / finance.totalPercent} />
        <Muted className="mt-2">
          {used}% dialokasikan · {remaining}% tersisa
        </Muted>
      </Card>

      <View className="mt-6">
        <Eyebrow>Saat sebuah grup selesai</Eyebrow>
        <Card className="mt-2">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-ink">
                Alokasikan {finance.incrementPercent}%?
              </Text>
              <Muted>
                {used}% dari {finance.totalPercent}% terpakai bulan ini
              </Muted>
            </View>
            <View className="flex-row gap-2">
              <SecondaryButton
                label="Nanti"
                className="px-3 py-3"
                onPress={() => toast.show('Dilewati dulu.')}
              />
              <PrimaryButton
                label="Sudah"
                className="w-auto px-4 py-3"
                disabled={atCap}
                onPress={() => {
                  allocate();
                  toast.show('Tercatat sebagai sudah kamu transfer sendiri.');
                }}
              />
            </View>
          </View>
          {atCap ? (
            <Muted className="mt-3">
              Jatah bulan ini sudah penuh. Prompt berhenti di sini — bukan dipaksa lebih.
            </Muted>
          ) : null}
        </Card>
      </View>

      <Card className="mt-4">
        <Eyebrow>Kalau terlewat</Eyebrow>
        <Text className="mt-2 text-[15px] font-bold text-ink">
          Nggak apa-apa. Yang penting jangan dua hari berturut-turut.
        </Text>
        <Muted className="mt-1">
          Alokasi cuma berhenti bertambah — tidak dikurangi. Berhasil lagi tepat sehari setelah
          gagal dapat bonus pemulihan kecil.
        </Muted>
      </Card>

      {financeLogs.length > 0 ? (
        <Card className="mt-4">
          <Eyebrow>Riwayat alokasi</Eyebrow>
          <View className="mt-2">
            {financeLogs.map((log, index) => (
              <View key={log.id}>
                {index > 0 ? <Divider className="my-2.5" /> : null}
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-ink">{log.date}</Text>
                  <Text className="text-sm font-extrabold text-brand">+{log.percent}%</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Text className="text-[15px] font-bold text-ink">{title}</Text>
      <Muted className="mt-1">{body}</Muted>
    </Card>
  );
}
