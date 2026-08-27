import { Screen } from '@/components/app/screen';
import { Card, Divider, Eyebrow, Muted, ProgressBar, SectionHead, Subtitle, Tag } from '@/components/app/ui';
import { formatDate } from '@/lib/date';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export default function IdentityScreen() {
  const router = useRouter();
  const { groups, identityTags, gatesFor, tagFor } = useStore();

  const mastered = groups.filter((group) => group.status === 'mastered');
  const building = groups.filter((group) => group.status === 'building');
  const topTag = identityTags.slice().sort((a, b) => b.points - a.points)[0];

  return (
    <Screen>
      <View className="mb-5 flex-row items-start justify-between">
        <View>
          <Eyebrow>Identitasmu</Eyebrow>
          <Subtitle className="mt-1">Kamu sedang jadi siapa</Subtitle>
        </View>
      </View>

      <View className="rounded-[26px] bg-brand p-5">
        <Text className="text-[13px] text-white/75">Identitas yang paling kamu pilih</Text>
        <Text className="mt-2 text-[25px] font-extrabold leading-8 text-white">
          Kamu sudah {topTag?.points ?? 0} kali memilih{'\n'}jadi orang yang {topTag?.label.toLowerCase() ?? 'kamu inginkan'}.
        </Text>
        <Text className="mt-2.5 text-[13px] text-white/80">
          {mastered.length} kebiasaan sudah jadi bagian tetap harimu · {building.length} masih dibentuk.
        </Text>
      </View>

      <View className="mt-6">
        <SectionHead title="Skema permanen" />
        {mastered.length === 0 ? (
          <Card>
            <Muted>Belum ada kebiasaan yang lulus. Itu wajar — butuh waktu.</Muted>
          </Card>
        ) : (
          <View className="gap-3">
            {mastered.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
              >
                <Card className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Tag>Permanen</Tag>
                    <Text className="mt-2 text-[15px] font-bold text-ink">{group.name}</Text>
                    <Muted>
                      Lulus {group.masteredAt ? formatDate(group.masteredAt) : '—'} · masih jalan
                    </Muted>
                  </View>
                  <Text className="text-2xl text-brand">✓</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View className="mt-6">
        <SectionHead title="Skema sementara" />
        <View className="gap-3">
          {building.map((group) => {
            const gates = gatesFor(group.id);
            const tag = tagFor(group.id);
            return (
              <Pressable
                key={group.id}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
              >
                <Card>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Tag tone="warn">Sedang dibentuk</Tag>
                      <Text className="mt-2 text-[15px] font-bold text-ink">{group.name}</Text>
                      <Muted>{tag ? tag.label : 'Belum punya identitas'}</Muted>
                    </View>
                  </View>
                  <Divider className="my-3" />
                  <GateRow
                    label="Poin identitas"
                    current={gates.points.current}
                    target={gates.points.target}
                    passed={gates.points.passed}
                  />
                  <GateRow
                    label="Konsistensi 30 hari"
                    current={gates.consistency.current}
                    target={gates.consistency.target}
                    passed={gates.consistency.passed}
                    suffix="%"
                  />
                  <GateRow
                    label="Umur kebiasaan"
                    current={gates.age.current}
                    target={gates.age.target}
                    passed={gates.age.passed}
                    suffix=" hari"
                  />
                </Card>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-6">
        <SectionHead title="Poin identitas" />
        <Card>
          {identityTags.map((tag, index) => (
            <View key={tag.id}>
              {index > 0 ? <Divider className="my-3" /> : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-[14px] text-ink">{tag.label}</Text>
                <Text className="text-[15px] font-extrabold text-ink">{tag.points}</Text>
              </View>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

function GateRow({
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
    <View className="mb-2.5">
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
