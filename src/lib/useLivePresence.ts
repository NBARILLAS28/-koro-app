import { useEffect, useRef, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface PresenceMeta {
  display_name: string;
  following: boolean;
}

interface SharedEntry {
  channel: RealtimeChannel;
  refCount: number;
  listeners: Set<(state: Record<string, PresenceMeta[]>) => void>;
  lastState: Record<string, PresenceMeta[]>;
}

// Registro compartido a nivel de módulo: si dos pantallas montan este hook
// para la MISMA comunidad al mismo tiempo (pasa durante la animación de
// navegación entre pantallas, o porque una pantalla usa el setlist y otra
// la canción), ambas deben terminar viendo el mismo canal de Supabase — no
// solo para evitar el crash de "no se puede suscribir dos veces", sino
// porque la presencia necesita que todos estén en la misma "sala" para
// poder verse entre sí. Cada instancia del hook suma/resta una referencia;
// el canal real solo se crea una vez y solo se cierra cuando la última
// pantalla que lo usaba se desmonta.
const registry = new Map<string, SharedEntry>();

function getOrCreateChannel(topic: string, presenceKey: string): SharedEntry {
  const existing = registry.get(topic);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }

  const channel = supabase.channel(topic, { config: { presence: { key: presenceKey } } });
  const entry: SharedEntry = { channel, refCount: 1, listeners: new Set(), lastState: {} };

  channel.on('presence', { event: 'sync' }, () => {
    entry.lastState = channel.presenceState() as any;
    entry.listeners.forEach((fn) => fn(entry.lastState));
  });

  channel.subscribe();
  registry.set(topic, entry);
  return entry;
}

function releaseChannel(topic: string) {
  const entry = registry.get(topic);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.channel.unsubscribe();
    registry.delete(topic);
  }
}

/**
 * Se une al canal de presencia de una comunidad y reporta la propia meta (nombre + si está
 * siguiendo el modo en vivo). Devuelve cuántos están conectados y cuántos siguiendo.
 *
 * `enabled` permite que el hook no trackee presencia cuando no aplica (ej: no hay sesión en vivo).
 */
export function useLivePresence(
  communityId: string | undefined,
  profileId: string | undefined,
  meta: PresenceMeta,
  enabled: boolean
) {
  const [presenceState, setPresenceState] = useState<Record<string, PresenceMeta[]>>({});
  const entryRef = useRef<SharedEntry | null>(null);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    if (!communityId || !profileId || !enabled) {
      setPresenceState({});
      return;
    }

    const topic = `presence:community:${communityId}`;
    const entry = getOrCreateChannel(topic, profileId);
    entryRef.current = entry;

    const listener = (state: Record<string, PresenceMeta[]>) => setPresenceState(state);
    entry.listeners.add(listener);
    setPresenceState(entry.lastState); // por si ya había estado (otra pantalla ya conectada)

    // Reporta la propia presencia. Como el canal es compartido, si dos
    // pantallas de este mismo dispositivo trackean a la vez, gana la
    // última llamada — aceptable, ambas representan al mismo usuario.
    entry.channel.track(metaRef.current).catch(() => {});

    return () => {
      entry.listeners.delete(listener);
      releaseChannel(topic);
      entryRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, profileId, enabled]);

  // Si cambia si estoy siguiendo o mi nombre, actualizo lo que reporto sin reabrir el canal.
  useEffect(() => {
    if (entryRef.current) {
      entryRef.current.channel.track(meta).catch(() => {});
    }
  }, [meta.following, meta.display_name]);

  const members = Object.values(presenceState).flat() as PresenceMeta[];
  const totalOnline = members.length;
  const followingCount = members.filter((m) => m.following).length;

  return { totalOnline, followingCount, members };
}
