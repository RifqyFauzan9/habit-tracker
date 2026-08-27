import { cn } from '@/lib/cn';
import React from 'react';
import { Pressable, Text, View, type PressableProps, type ViewProps } from 'react-native';

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={cn('text-[10px] font-extrabold uppercase tracking-[1.4px] text-brand', className)}>
      {children}
    </Text>
  );
}

export function Title({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={cn('mt-2 text-[29px] font-extrabold leading-[32px] tracking-tight text-ink', className)}>
      {children}
    </Text>
  );
}

export function Subtitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={cn('text-[22px] font-bold tracking-tight text-ink', className)}>{children}</Text>;
}

export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={cn('text-[13px] leading-[19px] text-ink-muted', className)}>{children}</Text>;
}

export function Card({ className, children, ...rest }: ViewProps & { children: React.ReactNode }) {
  return (
    <View
      className={cn('rounded-[22px] border border-hairline bg-surface-card p-4', className)}
      {...rest}
    >
      {children}
    </View>
  );
}

export function SectionHead({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="mb-2.5 flex-row items-center justify-between">
      <Text className="text-[15px] font-bold text-ink">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-xs font-extrabold text-brand">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Tag({
  children,
  tone = 'brand',
}: {
  children: React.ReactNode;
  tone?: 'brand' | 'warn' | 'neutral';
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand',
    warn: 'bg-warn-soft text-warn',
    neutral: 'bg-surface-sunken text-ink-muted',
  } as const;
  return (
    <View className={cn('self-start rounded-full px-2 py-1', tones[tone].split(' ')[0])}>
      <Text className={cn('text-[10px] font-extrabold uppercase', tones[tone].split(' ')[1])}>
        {children}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const width = `${Math.max(0, Math.min(100, Math.round(value * 100)))}%` as const;
  return (
    <View className={cn('h-[7px] overflow-hidden rounded-full bg-surface-sunken', className)}>
      <View className="h-full rounded-full bg-brand" style={{ width }} />
    </View>
  );
}

interface ButtonProps extends PressableProps {
  label: string;
  className?: string;
}

export function PrimaryButton({ label, className, ...rest }: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'w-full items-center rounded-2xl bg-brand px-4 py-4 active:opacity-80',
        rest.disabled && 'opacity-40',
        className
      )}
      {...rest}
    >
      <Text className="text-[15px] font-extrabold text-white">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, className, ...rest }: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'items-center rounded-2xl bg-brand-soft px-4 py-4 active:opacity-80',
        className
      )}
      {...rest}
    >
      <Text className="text-[15px] font-extrabold text-brand">{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, className, ...rest }: ButtonProps) {
  return (
    <Pressable className={cn('items-center px-4 py-3', className)} {...rest}>
      <Text className="text-[13px] font-bold text-ink-muted">{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-full px-3 py-2.5 active:opacity-70',
        selected ? 'bg-brand' : 'bg-surface-sunken'
      )}
    >
      <Text className={cn('text-xs font-bold', selected ? 'text-white' : 'text-ink-muted')}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-[17px] border bg-surface-card px-4 py-4 active:opacity-80',
        selected ? 'border-2 border-brand bg-brand-soft' : 'border-hairline'
      )}
    >
      <Text className={cn('text-[15px] font-semibold', selected ? 'text-brand' : 'text-ink')}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          className={cn(
            'h-1 w-7 rounded-full',
            index <= current ? 'bg-brand' : 'bg-surface-sunken'
          )}
        />
      ))}
    </View>
  );
}

export function CheckCircle({ done, onPress }: { done: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      className={cn(
        'h-[42px] w-[42px] items-center justify-center rounded-[14px] border-2 active:opacity-70',
        done ? 'border-brand bg-brand' : 'border-hairline bg-surface-card'
      )}
    >
      <Text className={cn('text-xl font-bold', done ? 'text-white' : 'text-transparent')}>✓</Text>
    </Pressable>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cn('h-px bg-hairline', className)} />;
}

export function BigNumber({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={cn('text-[46px] font-black tracking-tighter text-ink', className)}>
      {children}
    </Text>
  );
}

export function ModalHeader({
  onClose,
  label,
  right,
  closeIcon = '\u2039',
}: {
  onClose: () => void;
  label: string;
  right?: React.ReactNode;
  closeIcon?: string;
}) {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <Pressable onPress={onClose} hitSlop={10} className="h-9 w-9 items-center justify-center">
        <Text className="text-xl text-ink">{closeIcon}</Text>
      </Pressable>
      <Eyebrow>{label}</Eyebrow>
      <View className="h-9 min-w-9 items-end justify-center">{right}</View>
    </View>
  );
}
