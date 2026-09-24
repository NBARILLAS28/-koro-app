import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { LiveSession, SetlistSong } from '@/types';

export function useLiveSession(communityId: string | undefined) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!communityId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Estado inicial
    supabase
      .from('live_sessions')
      .select('*')
      .eq('community_id', communityId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setSession((data as LiveSession) ?? null);
          setLoading(false);
        }
      });

    // Suscripción en tiempo real a cambios en la fila de esta comunidad.
    // Nombre de canal único por instancia del hook (no solo por comunidad):
    // si dos pantallas montan este hook al mismo tiempo para la misma
    // comunidad (pasa durante la animación de navegación entre pantallas),
    // Supabase reutiliza el canal ya suscrito y truena al intentar agregar
    // un segundo listener con "cannot add postgres_changes callbacks...
    // after subscribe()". Un sufijo aleatorio evita esa colisión.
    const uniqueId = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`live_session:${communityId}:${uniqueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSession(null);
          } else {
            setSession(payload.new as LiveSession);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [communityId]);

  /** El director avanza/retrocede o selecciona un tema del setlist para toda la comunidad */
  async function goToSong(
    setlist_id: string,
    setlistSong: SetlistSong,
    currentKey: string
  ) {
    if (!communityId) return { error: 'Sin comunidad' };
    const { error } = await supabase.rpc('start_or_update_live_session', {
      p_community_id: communityId,
      p_setlist_id: setlist_id,
      p_setlist_song_id: setlistSong.id,
      p_song_id: setlistSong.song_id,
      p_current_key: currentKey,
    });
    return { error: error?.message ?? null };
  }

  async function stop() {
    if (!communityId) return;
    await supabase.rpc('stop_live_session', { p_community_id: communityId });
  }

  return {
    session: session?.is_active ? session : null,
    rawSession: session,
    loading,
    goToSong,
    stop,
  };
}
