import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { MemberRole } from '@/types';
import { useAuth } from './AuthContext';

export function useMemberRole(communityId: string | undefined) {
  const { session } = useAuth();
  const [role, setRole] = useState<MemberRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!communityId || !session?.user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('profile_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setRole((data?.role as MemberRole) ?? null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [communityId, session?.user?.id]);

  const isDirector = role === 'admin' || role === 'director';
  return { role, isDirector, loading };
}
