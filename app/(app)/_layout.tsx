import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { useRegisterPushToken } from '@/lib/useRegisterPushToken';

export default function AppLayout() {
  const { session } = useAuth();
  useRegisterPushToken(session?.user?.id);

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="communities" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="community/[id]/index" />
      <Stack.Screen name="community/[id]/members" />
      <Stack.Screen name="community/[id]/songs" />
      <Stack.Screen name="setlist/[id]" />
      <Stack.Screen name="song/[id]/index" />
      <Stack.Screen name="song/[id]/edit" />
    </Stack>
  );
}
