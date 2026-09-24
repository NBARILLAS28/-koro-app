import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { colors } from '@/theme';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';

const MAX_CONTENT_WIDTH = 640; // ancho cómodo de lectura; en tablet/web centra el contenido

function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

/**
 * En pantallas anchas (tablet, web, iPad landscape) centra el contenido en una columna
 * de ancho cómodo en vez de estirar cada elemento de borde a borde. En celular normal
 * (ancho < MAX_CONTENT_WIDTH) no tiene ningún efecto.
 */
function ResponsiveContainer({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const isWide = width > MAX_CONTENT_WIDTH;

  if (!isWide) return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center' }}>
      <View style={{ flex: 1, width: MAX_CONTENT_WIDTH, maxWidth: '100%' }}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <ResponsiveContainer>
        <RootNavigator />
      </ResponsiveContainer>
    </AuthProvider>
  );
}

