import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Song, Comment, SetlistSong } from '@/types';
import { colors, radius, spacing, webSafeBottom } from '@/theme';
import { parseChordProLine, semitoneDistance, shiftKey, transposeChordPro } from '@/utils/chords';
import * as WebBrowser from 'expo-web-browser';
import { useLiveSession } from '@/lib/useLiveSession';
import { useMemberRole } from '@/lib/useMemberRole';
import { useLivePresence } from '@/lib/useLivePresence';
import { useAuth } from '@/lib/AuthContext';
import { cacheGet, cacheKeys, cacheSet } from '@/lib/offlineCache';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/components/Toast';
import { useMetronome } from '@/lib/useMetronome';
import { MetronomeDot } from '@/components/MetronomeDot';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return match ? match[1] : null;
}

export default function SongScreen() {
  const { id, setlistSongId } = useLocalSearchParams<{ id: string; setlistSongId?: string }>();
  const { width } = useWindowDimensions();
  const [song, setSong] = useState<Song | null>(null);
  const [setlistSong, setSetlistSong] = useState<SetlistSong | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [semitoneShift, setSemitoneShift] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [following, setFollowing] = useState(true);
  const [offline, setOffline] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2); // 1 (lento) a 5 (rápido)
  const [fontSize, setFontSize] = useState(16);
  const { showToast, Toast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);

  const { isDirector } = useMemberRole(song?.community_id);
  const { session: liveSession, goToSong: liveGoToSong } = useLiveSession(song?.community_id);

  // Metrónomo: 100% local a este dispositivo, nunca se sincroniza por red.
  // Audible solo si NO hay una transmisión en vivo activa en la comunidad
  // (o sea, en modo ensayo personal); en vivo solo queda el pulso visual.
  const [tempoOverride, setTempoOverride] = useState<number | null>(null);
  const effectiveBpm = tempoOverride ?? song?.bpm ?? 120;
  const metronome = useMetronome(effectiveBpm, !liveSession, 4);
  const { session, profile } = useAuth();
  const hasNavigatedForSession = useRef<string | null>(null);

  const { followingCount, totalOnline } = useLivePresence(
    song?.community_id,
    session?.user?.id,
    { display_name: profile?.display_name ?? 'Alguien', following: isDirector ? false : following },
    !!liveSession
  );

  const load = useCallback(async () => {
    try {
      const { data: s, error: songError } = await supabase.from('songs').select('*').eq('id', id).single();
      if (songError) throw songError;
      setSong(s ?? null);
      setTempoOverride(null);

      if (setlistSongId) {
        const { data: ss } = await supabase.from('setlist_songs').select('*').eq('id', setlistSongId).single();
        setSetlistSong(ss ?? null);
        if (ss?.transposed_key && s) {
          setSemitoneShift(semitoneDistance(s.original_key, ss.transposed_key));
        }
      }

      const { data: c } = await supabase
        .from('comments')
        .select('*, profile:profiles(display_name)')
        .eq('song_id', id)
        .order('created_at', { ascending: true });
      setComments((c as any) ?? []);
      setOffline(false);

      if (s) await cacheSet(cacheKeys.song(id), s);
      if (c) await cacheSet(cacheKeys.comments(id), c);
    } catch {
      const [cachedSong, cachedComments] = await Promise.all([
        cacheGet<Song>(cacheKeys.song(id)),
        cacheGet<Comment[]>(cacheKeys.comments(id)),
      ]);
      if (cachedSong) {
        setSong(cachedSong.data);
        if (cachedSong.data.original_key) setSemitoneShift(0); // sin datos de setlist_songs offline, se muestra el tono original
      }
      setComments(cachedComments?.data ?? []);
      setOffline(true);
    }
  }, [id, setlistSongId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ---------- Director en vivo: seguidores saltan automáticamente al tema activo ----------
  useEffect(() => {
    if (!liveSession || isDirector || !following) return;
    // Si el director está mostrando otro tema distinto al que estoy viendo, salto ahí.
    if (
      liveSession.current_setlist_song_id &&
      liveSession.current_setlist_song_id !== setlistSongId &&
      hasNavigatedForSession.current !== liveSession.updated_at
    ) {
      hasNavigatedForSession.current = liveSession.updated_at;
      router.replace(
        `/(app)/song/${liveSession.current_song_id}?setlistSongId=${liveSession.current_setlist_song_id}`
      );
    }
  }, [liveSession, isDirector, following, setlistSongId]);

  // Si soy seguidor y el director cambió la tonalidad de ESTE mismo tema, la reflejo
  useEffect(() => {
    if (!liveSession || isDirector || !following || !song) return;
    if (liveSession.current_setlist_song_id === setlistSongId && liveSession.current_key) {
      setSemitoneShift(semitoneDistance(song.original_key, liveSession.current_key));
    }
  }, [liveSession?.current_key, liveSession?.current_setlist_song_id]);

  // ---------- Autoscroll de letra ----------
  useEffect(() => {
    if (!autoScroll) return;
    const pxPerTick = scrollSpeed * 0.8;
    const interval = setInterval(() => {
      const maxOffset = Math.max(scrollContentHeightRef.current - scrollViewHeightRef.current, 0);
      const next = Math.min(scrollOffsetRef.current + pxPerTick, maxOffset);
      scrollOffsetRef.current = next;
      scrollRef.current?.scrollTo({ y: next, animated: false });
      if (next >= maxOffset) setAutoScroll(false); // llegó al final, se detiene solo
    }, 50);
    return () => clearInterval(interval);
  }, [autoScroll, scrollSpeed]);

  const currentKey = useMemo(() => {
    if (!song) return '';
    return shiftKey(song.original_key, semitoneShift);
  }, [song, semitoneShift]);

  const isBroadcastingThisSong =
    isDirector && liveSession?.current_setlist_song_id === setlistSongId;

  const transposedLyrics = useMemo(() => {
    if (!song?.lyrics_chordpro) return '';
    return transposeChordPro(song.lyrics_chordpro, semitoneShift, currentKey);
  }, [song?.lyrics_chordpro, semitoneShift, currentKey]);

  const applyShift = async (delta: number) => {
    const newShift = semitoneShift + delta;
    setSemitoneShift(newShift);
    if (!song || offline) return;
    const newKey = shiftKey(song.original_key, newShift);

    if (setlistSong) {
      await supabase.from('setlist_songs').update({ transposed_key: newKey }).eq('id', setlistSong.id);
    }
    // Si estoy transmitiendo en vivo este tema, mi cambio de tono se propaga a todos.
    if (isBroadcastingThisSong && setlistSong) {
      await liveGoToSong(liveSession!.setlist_id!, setlistSong, newKey);
    }
  };

  // Convierte la vista previa de transposición en el cifrado real y guardado
  // de la canción — a partir de aquí es la tonalidad oficial para TODOS los
  // integrantes de la comunidad, no solo una vista temporal de esta pantalla.
  // Se propaga en tiempo real vía la suscripción de abajo (Realtime sobre la
  // fila de esta canción), que ya cualquier otro dispositivo viéndola recibe.
  const [savingOfficial, setSavingOfficial] = useState(false);
  const saveOfficialTranspose = async () => {
    if (!song || semitoneShift === 0) return;
    setSavingOfficial(true);
    const newKey = currentKey;
    const newLyrics = transposedLyrics;

    const { error } = await supabase
      .from('songs')
      .update({ original_key: newKey, lyrics_chordpro: newLyrics, updated_at: new Date().toISOString() })
      .eq('id', song.id);

    // El override de este setlist ya no aplica: el original ya ES la tonalidad
    // que se estaba mostrando, así que se limpia para no calcular un desfase
    // sobre la nueva referencia.
    if (!error && setlistSong) {
      await supabase.from('setlist_songs').update({ transposed_key: null }).eq('id', setlistSong.id);
    }

    setSavingOfficial(false);
    if (error) {
      showAlert('No se pudo guardar', friendlyError(error));
      return;
    }
    setSong({ ...song, original_key: newKey, lyrics_chordpro: newLyrics });
    setSemitoneShift(0);
    showToast('Tonalidad oficial actualizada ✓');
  };

  // Escucha cambios en tiempo real de ESTA canción (Realtime) — si alguien más
  // guarda una nueva tonalidad oficial (o edita la letra) mientras la tengo
  // abierta, la veo reflejada al instante sin tener que recargar. Canal único
  // por instancia (evita el choque de "cannot add postgres_changes callbacks
  // ... after subscribe()" cuando dos pantallas escuchan la misma comunidad).
  useEffect(() => {
    if (!id) return;
    const uniqueId = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`song:${id}:${uniqueId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'songs', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Song;
          setSong((prev) => (prev ? { ...prev, ...updated } : updated));
          // La tonalidad "base" cambió — la vista previa local vuelve a cero
          // para no sumarse sobre la referencia nueva (evita un doble desfase).
          setSemitoneShift(0);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [id]);

  // Abre una búsqueda en el navegador (no copiamos ni mostramos el contenido de
  // estos sitios dentro de la app — solo enlazamos afuera, como un marcador).
  // Así evitamos cualquier problema de derechos de autor sobre letras/acordes
  // de canciones de terceros, y el integrante puede copiar lo que necesite a
  // mano hacia el editor de KORO.
  const searchChordsExternally = (site: 'cifraclub' | 'lacuerda') => {
    if (!song) return;
    const query = encodeURIComponent(`${song.title} ${song.artist ?? ''} acordes`.trim());
    const domain = site === 'cifraclub' ? 'cifraclub.com' : 'lacuerda.net';
    const url = `https://www.google.com/search?q=site:${domain}+${query}`;
    WebBrowser.openBrowserAsync(url);
  };

  const saveYoutubeLink = async () => {
    if (!youtubeInput.trim() || !song) return;
    const { error } = await supabase.from('songs').update({ youtube_url: youtubeInput.trim() }).eq('id', song.id);
    setShowYoutubeInput(false);
    setYoutubeInput('');
    if (error) showAlert('No se pudo guardar el link', friendlyError(error));
    else {
      showToast('Link de YouTube guardado ✓');
      load();
    }
  };

  const postComment = async () => {
    if (offline) return showAlert('Sin conexión', 'No puedes comentar sin internet. Intenta de nuevo cuando recuperes la conexión.');
    if (!newComment.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from('comments').insert({
      song_id: id,
      profile_id: userData.user.id,
      body: newComment.trim(),
    });
    if (error) showAlert('No se pudo enviar', friendlyError(error));
    else {
      setNewComment('');
      showToast('Comentario enviado ✓');
      load();
    }
  };

  if (!song) return null;

  const youtubeId = extractYoutubeId(song.youtube_url);
  const lines = transposedLyrics.split('\n');
  const showFollowBanner = !isDirector && !!liveSession;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: spacing(28) }}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        onContentSizeChange={(_, h) => { scrollContentHeightRef.current = h; }}
        onLayout={(e) => { scrollViewHeightRef.current = e.nativeEvent.layout.height; }}
        scrollEventThrottle={32}
      >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>{song.title}</Text>
        {song.artist ? <Text style={styles.artist}>{song.artist}</Text> : null}
      </View>

      {offline && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>📴 Sin conexión — mostrando la última versión guardada de este tema</Text>
        </View>
      )}

      {/* Barra de estado en vivo */}
      {isBroadcastingThisSong && (
        <View style={styles.broadcastBar}>
          <View style={styles.liveDot} />
          <Text style={styles.broadcastText}>
            Transmitiendo en vivo — {followingCount} de {Math.max(totalOnline - 1, followingCount)} siguiendo
          </Text>
        </View>
      )}
      {showFollowBanner && (
        <Pressable style={styles.followBar} onPress={() => setFollowing((f) => !f)}>
          <View style={[styles.liveDot, !following && { backgroundColor: colors.textMuted }]} />
          <Text style={styles.followBarText}>
            {following ? 'Siguiendo al director en vivo' : 'Dejaste de seguir al director'}
          </Text>
          <Text style={styles.followBarAction}>{following ? 'Dejar de seguir' : 'Seguir'}</Text>
        </Pressable>
      )}

      {/* Control de tonalidad */}
      <View style={styles.keyBar}>
        <Pressable style={styles.keyButton} onPress={() => applyShift(-1)}>
          <Text style={styles.keyButtonText}>−</Text>
        </Pressable>
        <View style={styles.keyDisplay}>
          <Text style={styles.keyLabel}>Tonalidad</Text>
          <Text style={styles.keyValue}>{currentKey}</Text>
          {semitoneShift !== 0 && <Text style={styles.keyOriginal}>original: {song.original_key}</Text>}
        </View>
        <Pressable style={styles.keyButton} onPress={() => applyShift(1)}>
          <Text style={styles.keyButtonText}>+</Text>
        </Pressable>
      </View>

      {semitoneShift !== 0 && !offline && (
        isBroadcastingThisSong ? (
          <Text style={styles.saveOfficialHint}>
            Estás transmitiendo en vivo — finaliza la transmisión para guardar esta tonalidad como oficial.
          </Text>
        ) : (
          <Pressable style={styles.saveOfficialBtn} onPress={saveOfficialTranspose} disabled={savingOfficial}>
            <Text style={styles.saveOfficialBtnText}>
              {savingOfficial ? 'Guardando...' : `Guardar ${currentKey} como tonalidad oficial`}
            </Text>
          </Pressable>
        )
      )}

      {/* Metrónomo — local a este dispositivo, nunca sincronizado por red */}
      <View style={styles.metroBar}>
        <Pressable
          style={[styles.metroPlay, metronome.isPlaying && styles.metroPlayActive]}
          onPress={metronome.toggle}
        >
          <Text style={styles.metroPlayText}>{metronome.isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>

        <View style={styles.metroPulseRow}>
          {metronome.dots.map((dotValue, i) => (
            <MetronomeDot key={i} value={dotValue} accent={i === 0} />
          ))}
        </View>

        <Pressable
          style={styles.metroStepBtn}
          onPress={() => setTempoOverride(Math.max(30, effectiveBpm - 5))}
        >
          <Text style={styles.metroStepText}>−</Text>
        </Pressable>
        <Text style={styles.metroBpmValue}>{effectiveBpm}</Text>
        <Text style={styles.metroBpmLabel}>BPM</Text>
        <Pressable
          style={styles.metroStepBtn}
          onPress={() => setTempoOverride(Math.min(300, effectiveBpm + 5))}
        >
          <Text style={styles.metroStepText}>+</Text>
        </Pressable>
      </View>
      {!liveSession ? (
        <Text style={styles.metroHint}>Modo ensayo: clic audible activado</Text>
      ) : (
        <Text style={styles.metroHint}>En vivo: solo pulso visual (sin audio)</Text>
      )}

      {/* Video de YouTube */}
      {youtubeId ? (
        <View style={styles.videoBlock}>
          <Pressable onPress={() => setShowVideo(!showVideo)}>
            <Text style={styles.videoToggle}>{showVideo ? 'Ocultar video ▲' : 'Ver video de referencia ▼'}</Text>
          </Pressable>
          {showVideo && (
            <View style={{ borderRadius: radius.md, overflow: 'hidden', marginTop: spacing(2) }}>
              <YouTubeEmbed height={width * 0.5625 - 32} videoId={youtubeId} play={showVideo} />
            </View>
          )}
        </View>
      ) : (
        <Pressable style={styles.addYoutube} onPress={() => setShowYoutubeInput(true)}>
          <Text style={styles.addYoutubeText}>+ Agregar link de YouTube</Text>
        </Pressable>
      )}

      {showYoutubeInput && (
        <View style={styles.youtubeInputRow}>
          <TextInput
            style={styles.youtubeInput}
            placeholder="https://youtube.com/watch?v=..."
            placeholderTextColor={colors.textMuted}
            value={youtubeInput}
            onChangeText={setYoutubeInput}
            autoCapitalize="none"
          />
          <Pressable style={styles.youtubeSave} onPress={saveYoutubeLink}>
            <Text style={styles.youtubeSaveText}>Guardar</Text>
          </Pressable>
        </View>
      )}

      {/* Letra + acordes */}
      <View style={styles.lyricsBlock}>
        <View style={styles.lyricsHeader}>
          <Text style={styles.lyricsHeaderTitle}>Letra y acordes</Text>
          {!offline && (
            <Pressable onPress={() => router.push(`/(app)/song/${id}/edit`)}>
              <Text style={styles.editLink}>{song.lyrics_chordpro ? 'Editar' : '+ Agregar letra'}</Text>
            </Pressable>
          )}
        </View>

        {!offline && (
          <View style={styles.searchRow}>
            <Text style={styles.searchRowLabel}>Buscar referencia:</Text>
            <Pressable style={styles.searchChip} onPress={() => searchChordsExternally('cifraclub')}>
              <Text style={styles.searchChipText}>CifraClub</Text>
            </Pressable>
            <Pressable style={styles.searchChip} onPress={() => searchChordsExternally('lacuerda')}>
              <Text style={styles.searchChipText}>La Cuerda</Text>
            </Pressable>
          </View>
        )}
        {song.lyrics_chordpro ? (
          lines.map((line, i) => (
            <View key={i} style={styles.lyricLine}>
              {parseChordProLine(line).map((seg, j) => (
                <View key={j} style={styles.segment}>
                  {seg.chord ? (
                    <Text style={[styles.chord, { fontSize: fontSize * 0.8 }]}>{seg.chord}</Text>
                  ) : (
                    <Text style={[styles.chordPlaceholder, { fontSize: fontSize * 0.8 }]}> </Text>
                  )}
                  <Text style={[styles.lyric, { fontSize }]}>{seg.lyric || ' '}</Text>
                </View>
              ))}
            </View>
          ))
        ) : (
          <Text style={styles.noLyrics}>Sin letra/acordes cargados todavía para este tema.</Text>
        )}
      </View>

      {/* Comentarios */}
      <View style={styles.commentsBlock}>
        <Text style={styles.commentsTitle}>Comentarios</Text>
        {comments.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Text style={styles.commentAuthor}>{(c as any).profile?.display_name ?? 'Alguien'}</Text>
            <Text style={styles.commentBody}>{c.body}</Text>
          </View>
        ))}
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Escribe un comentario (ej: bajar tempo en el puente)"
            placeholderTextColor={colors.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <Pressable style={styles.commentSend} onPress={postComment}>
            <Text style={styles.commentSendText}>Enviar</Text>
          </Pressable>
        </View>
      </View>
      </ScrollView>

      {/* Barra flotante de autoscroll y tamaño de letra (solo si hay letra) */}
      {song.lyrics_chordpro ? (
        <View style={styles.autoscrollBar}>
          <View style={styles.autoscrollRow}>
            <Pressable style={styles.autoscrollPlay} onPress={() => setAutoScroll((v) => !v)}>
              <Text style={styles.autoscrollPlayText}>{autoScroll ? '⏸' : '▶'}</Text>
            </Pressable>
            <Pressable
              style={styles.autoscrollSpeedBtn}
              onPress={() => setScrollSpeed((s) => Math.max(1, s - 1))}
            >
              <Text style={styles.autoscrollSpeedText}>−</Text>
            </Pressable>
            <Text style={styles.autoscrollSpeedLabel}>{scrollSpeed}x</Text>
            <Pressable
              style={styles.autoscrollSpeedBtn}
              onPress={() => setScrollSpeed((s) => Math.min(5, s + 1))}
            >
              <Text style={styles.autoscrollSpeedText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.autoscrollDivider} />
          <View style={styles.autoscrollRow}>
            <Pressable
              style={styles.autoscrollSpeedBtn}
              onPress={() => setFontSize((s) => Math.max(12, s - 2))}
            >
              <Text style={styles.autoscrollFontBtnText}>A−</Text>
            </Pressable>
            <Text style={styles.autoscrollSpeedLabel}>Letra</Text>
            <Pressable
              style={styles.autoscrollSpeedBtn}
              onPress={() => setFontSize((s) => Math.min(28, s + 2))}
            >
              <Text style={styles.autoscrollFontBtnText}>A+</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing(5), paddingTop: spacing(14) },
  back: { color: colors.textMuted, marginBottom: spacing(3) },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  artist: { color: colors.textMuted, marginTop: spacing(1) },

  broadcastBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing(4),
    marginBottom: spacing(3),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.danger,
  },
  broadcastText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  offlineBar: {
    marginHorizontal: spacing(4),
    marginBottom: spacing(3),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  offlineText: { color: colors.textMuted, fontSize: 12 },
  followBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing(4),
    marginBottom: spacing(3),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  followBarText: { color: colors.text, fontSize: 13, flex: 1, marginLeft: spacing(0.5) },
  followBarAction: { color: colors.accentChord, fontSize: 12, fontWeight: '700' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, marginRight: spacing(2) },

  keyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    marginHorizontal: spacing(4),
    borderRadius: radius.md,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyButton: { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  keyButtonText: { color: '#12121A', fontSize: 22, fontWeight: '800' },
  keyDisplay: { alignItems: 'center' },
  keyLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  keyValue: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  keyOriginal: { color: colors.textMuted, fontSize: 11 },
  saveOfficialBtn: {
    marginHorizontal: spacing(4),
    marginTop: spacing(2),
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  saveOfficialBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  saveOfficialHint: {
    marginHorizontal: spacing(4),
    marginTop: spacing(2),
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  metroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing(4),
    marginTop: spacing(3),
    borderRadius: radius.md,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2),
  },
  metroPlay: { backgroundColor: colors.surfaceAlt, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  metroPlayActive: { backgroundColor: colors.primary },
  metroPlayText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  metroPulseRow: { flexDirection: 'row', gap: spacing(1.5), flex: 1, justifyContent: 'center' },
  metroStepBtn: { backgroundColor: colors.surfaceAlt, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  metroStepText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  metroBpmValue: { color: colors.primary, fontSize: 16, fontWeight: '800', minWidth: 32, textAlign: 'center' },
  metroBpmLabel: { color: colors.textMuted, fontSize: 10 },
  metroHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing(1.5) },
  videoBlock: { marginHorizontal: spacing(4), marginTop: spacing(4) },
  videoToggle: { color: colors.accentChord, fontWeight: '600' },
  addYoutube: { marginHorizontal: spacing(4), marginTop: spacing(4) },
  addYoutubeText: { color: colors.accentChord },
  youtubeInputRow: { flexDirection: 'row', marginHorizontal: spacing(4), marginTop: spacing(2), gap: spacing(2) },
  youtubeInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing(3), color: colors.text },
  youtubeSave: { backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: 'center', paddingHorizontal: spacing(4) },
  youtubeSaveText: { color: '#12121A', fontWeight: '700' },
  lyricsBlock: { marginHorizontal: spacing(4), marginTop: spacing(6), backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(4), borderWidth: 1, borderColor: colors.border },
  lyricLine: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(3) },
  segment: { marginRight: spacing(0.5) },
  chord: { color: colors.accentChord, fontWeight: '800', fontSize: 13 },
  chordPlaceholder: { fontSize: 13 },
  lyric: { color: colors.text, fontSize: 16 },
  noLyrics: { color: colors.textMuted, textAlign: 'center' },
  lyricsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(3) },
  lyricsHeaderTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  editLink: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginBottom: spacing(3), flexWrap: 'wrap' },
  searchRowLabel: { color: colors.textMuted, fontSize: 12 },
  searchChip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: spacing(1.5), paddingHorizontal: spacing(2.5) },
  searchChipText: { color: colors.accentChord, fontSize: 12, fontWeight: '600' },
  commentsBlock: { marginHorizontal: spacing(4), marginTop: spacing(6) },
  commentsTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing(3) },
  comment: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing(3), marginBottom: spacing(2) },
  commentAuthor: { color: colors.primary, fontWeight: '700', fontSize: 12, marginBottom: spacing(1) },
  commentBody: { color: colors.text },
  commentInputRow: { flexDirection: 'row', marginTop: spacing(3), gap: spacing(2), alignItems: 'flex-end' },
  commentInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing(3), color: colors.text, minHeight: 44 },
  commentSend: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing(3), paddingHorizontal: spacing(4) },
  commentSendText: { color: '#12121A', fontWeight: '700' },
  autoscrollBar: {
    position: 'absolute',
    bottom: spacing(6) + webSafeBottom,
    left: spacing(4),
    right: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2.5),
    gap: spacing(1.5),
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  autoscrollPlay: { backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  autoscrollPlayText: { color: '#12121A', fontSize: 16, fontWeight: '800' },
  autoscrollSpeedBtn: { backgroundColor: colors.surfaceAlt, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  autoscrollSpeedText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  autoscrollSpeedLabel: { color: colors.textMuted, fontSize: 12, flex: 1, textAlign: 'center' },
  autoscrollRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  autoscrollDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(0.5) },
  autoscrollFontBtnText: { color: colors.text, fontWeight: '800', fontSize: 13 },
});
