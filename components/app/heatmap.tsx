import { addDays, formatDate, toDateKey } from "@/lib/date";
import type { HabitLog } from "@/lib/types";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

const LEVELS = [
  "bg-surface-sunken",
  "bg-brand-soft",
  "bg-brand/40",
  "bg-brand/70",
  "bg-brand",
];

/** Weeks are columns, weekdays are rows — same reading order as a contribution graph. */
export function Heatmap({
  logs,
  groupId,
  weeks = 12,
}: {
  logs: HabitLog[];
  groupId?: string;
  weeks?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const cells = useMemo(() => {
    const scoped = groupId ? logs.filter((l) => l.groupId === groupId) : logs;
    const byDate = new Map<string, { done: number; total: number }>();
    scoped.forEach((log) => {
      const entry = byDate.get(log.date) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (log.status === "done") entry.done += 1;
      byDate.set(log.date, entry);
    });

    const today = new Date();
    const total = weeks * 7;
    const start = addDays(today, -(total - 1));
    return Array.from({ length: total }).map((_, index) => {
      const date = toDateKey(addDays(start, index));
      const entry = byDate.get(date);
      const ratio = entry && entry.total > 0 ? entry.done / entry.total : 0;
      const level = !entry
        ? 0
        : ratio === 0
          ? 1
          : ratio < 0.5
            ? 2
            : ratio < 1
              ? 3
              : 4;
      return { date, level, entry };
    });
  }, [logs, groupId, weeks]);

  const columns = useMemo(() => {
    const grouped: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7)
      grouped.push(cells.slice(i, i + 7));
    return grouped;
  }, [cells]);

  const selectedCell = cells.find((c) => c.date === selected);

  return (
    <View>
      <View className="flex-row gap-1">
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} className="flex-1 gap-1">
            {column.map((cell) => (
              <Pressable
                key={cell.date}
                onPress={() =>
                  setSelected(cell.date === selected ? null : cell.date)
                }
                className={`h-4 rounded-sm ${LEVELS[cell.level]} ${
                  cell.date === selected ? "border border-ink" : ""
                }`}
              />
            ))}
          </View>
        ))}
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-[11px] text-ink-muted">
          {selectedCell
            ? `${formatDate(selectedCell.date)} · ${
                selectedCell.entry
                  ? `${selectedCell.entry.done}/${selectedCell.entry.total} selesai`
                  : "tidak terjadwal"
              }`
            : `${weeks} minggu terakhir`}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="mr-1 text-[11px] text-ink-muted">Sedikit</Text>
          {LEVELS.map((level) => (
            <View key={level} className={`h-3 w-3 rounded-[3px] ${level}`} />
          ))}
          <Text className="ml-1 text-[11px] text-ink-muted">Banyak</Text>
        </View>
      </View>
    </View>
  );
}
