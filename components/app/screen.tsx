import { cn } from '@/lib/cn';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * SafeAreaView is re-exported by react-native-css without className interop, so
 * a class on it is silently dropped on native. Insets are applied as padding on
 * a plain View instead.
 */
export function Screen({
  children,
  className,
  footer,
  scroll = true,
}: {
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = <View className={cn('flex-1 px-5 pt-2', className)}>{children}</View>;

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? (
        <View className="bg-surface px-5 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}
