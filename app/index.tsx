import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';

export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/(app)/communities' : '/(auth)/login'} />;
}
