import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { BootGate } from '@/components/app/boot-gate';
import { ToastProvider } from '@/components/app/toast';
import '@/global.css';
import { StoreProvider } from '@/lib/store';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode="light">
        <StoreProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <BootGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding/index" options={{ presentation: 'modal' }} />
              <Stack.Screen name="habit/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="habit/check" options={{ presentation: 'modal' }} />
              <Stack.Screen name="habit/negotiate" options={{ presentation: 'modal' }} />
              <Stack.Screen name="habit/group" options={{ presentation: 'modal' }} />
              <Stack.Screen name="finance" options={{ presentation: 'modal' }} />
            </Stack>
            </BootGate>
          </ToastProvider>
        </StoreProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
