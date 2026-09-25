import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { SetlistSong, Setlist } from '@/types';
import { colors, radius, spacing, webSafeBottom } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { useLiveSession } from '@/lib/useLiveSession';
import { useMemberRole } from '@/lib/useMemberRole';
import { useLivePresence } from '@/lib/useLivePresence';
import { useAuth } from '@/lib/AuthContext';
import { cacheGet, cacheKeys, cacheSet } from '@/lib/offlineCache';

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [items, setItems] = useState<SetlistSong[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [songTitle, setSongTitle] = useState('');
  const [songKey, setSongKey] = useState('C');
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const { isDirector } = useMemberRole(setlist?.community_id);
  const { session: liveSession, goToSong, stop } = useLiveSession(setlist?.community_id);
  const { session: authSession, profile } = useAuth();
  const { followingCount, totalOnline } = useLivePresence(
    setlist?.community_id,
    authSession?.user?.id,
    { display_name: profile?.display_name ?? 'Alguien', following: false },
    !!liveSession
  );

  const load = useCallback(async () => {
    try {
      const { data: sl, error: slError } = await supabase.from('setlists').select('*').eq('id', id).single();
      const { data, error: itemsError } = await supabase
        .from('setlist_songs')
        .select('*, song:songs(*)')
        .eq('setlist_id', id)
        .order('position', { ascending: true });

      if (slError || itemsError) throw slError ?? itemsError;

      setSetlist(sl ?? null);
      setItems((data as any) ?? []);
      setOffline(false);
      setCachedAt(null);

      // Guardamos copia local para poder abrir este setlist sin conexión
      if (sl) await cacheSet(cacheKeys.setlist(id), sl);
      if (data) await cacheSet(cacheKeys.setlistSongs(id), data);
    } catch {
      // Sin conexión (o el servidor no respondió): usamos la última copia guardada localmente.
      const [cachedSetlist, cachedItems] = await Promise.all([
        cacheGet<Setlist>(cacheKeys.setlist(id)),
        cacheGet<SetlistSong[]>(cacheKeys.setlistSongs(id)),
      ]);
      if (cachedSetlist || cachedItems) {
        setSetlist(cachedSetlist?.data ?? null);
        setItems(cachedItems?.data ?? []);
        setOffline(true);
        setCachedAt(cachedSetlist?.cachedAt ?? cachedItems?.cachedAt ?? null);
      }
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const moveItem = async (index: number, direction: -1 | 1) => {
    if (offline) return showAlert('Sin conexión', 'No puedes reordenar el setlist sin internet.');
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const a = items[index];
    const b = items[targetIndex];
    await Promise.all([
      supabase.from('setlist_songs').update({ position: b.position }).eq('id', a.id),
      supabase.from('setlist_songs').update({ position: a.position }).eq('id', b.id),
    ]);
    load();
  };

  const removeFromSetlist = (item: SetlistSong) => {
    if (offline) return showAlert('Sin conexión', 'No puedes editar el setlist sin internet.');
    showAlert(
      'Quitar del setlist',
      `"${item.song?.title}" se quitará de este setlist (la canción sigue en la biblioteca).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('setlist_songs').delete().eq('id', item.id);
            if (error) showAlert('No se pudo quitar', friendlyError(error));
            else load();
          },
        },
      ]
    );
  };

  const createAndAddSong = async () => {
    if (offline) return showAlert('Sin conexión', 'No puedes agregar temas sin internet.');
    if (!songTitle.trim() || !setlist) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data: song, error } = await supabase
      .from('songs')
      .insert({
        community_id: setlist.community_id,
        title: songTitle.trim(),
        original_key: songKey,
        created_by: userData.user?.id,
      })
      .select()
      .single();

    if (error || !song) {
      showAlert('Error', friendlyError(error) ?? 'No se pudo crear la canción');
      return;
    }

    await supabase.from('setlist_songs').insert({
      setlist_id: id,
      song_id: song.id,
      position: items.length,
    });

    setAddModal(false);
    setSongTitle('');
    setSongKey('C');
    load();
  };

  const exportToPdf = async () => {
    if (!setlist) return;
    if (offline) return showAlert('Sin conexión', 'No puedes exportar a PDF sin internet.');

    const rows = items
      .map(
        (item, i) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${i + 1}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;font-weight:600;">${item.song?.title ?? ''}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${item.song?.artist ?? ''}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${
            item.transposed_key ?? item.song?.original_key ?? ''
          }</td>
        </tr>`
      )
      .join('');

    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px;">
          <h1 style="color:#12121A;margin-bottom:4px;">${setlist.title}</h1>
          <p style="color:#666;margin-top:0;">KORO · ${items.length} tema${items.length !== 1 ? 's' : ''}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <thead>
              <tr style="background:#12121A;color:#E8B84B;">
                <th style="padding:8px;text-align:left;">#</th>
                <th style="padding:8px;text-align:left;">Tema</th>
                <th style="padding:8px;text-align:left;">Artista</th>
                <th style="padding:8px;text-align:center;">Tono</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      else showAlert('PDF generado', `Guardado en: ${uri}`);
    } catch (e: any) {
      showAlert('No se pudo exportar', e?.message ?? 'Error desconocido');
    }
  };

  // ---------- Director en vivo ----------
  const liveIsThisSetlist = liveSession?.setlist_id === id;
  const liveIndex = liveIsThisSetlist
    ? items.findIndex((i) => i.id === liveSession?.current_setlist_song_id)
    : -1;

  const startLiveAt = async (index: number) => {
    const item = items[index];
    if (!item) return;
    const key = item.transposed_key ?? item.song?.original_key ?? 'C';
    const { error } = await goToSong(id, item, key);
    if (error) showAlert('No se pudo iniciar', error);
  };

  const liveStep = async (direction: -1 | 1) => {
    const nextIndex = liveIndex + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    await startLiveAt(nextIndex);
  };

  const goToLiveSong = () => {
    if (liveIndex < 0) return;
    const item = items[liveIndex];
    router.push(`/(app)/song/${item.song_id}?setlistSongId=${item.id}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>{setlist?.title ?? '...'}</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>{items.length} tema{items.length !== 1 ? 's' : ''}</Text>
          {items.length > 0 && (
            <Pressable onPress={exportToPdf}>
              <Text style={styles.exportLink}>📄 Exportar a PDF</Text>
            </Pressable>
          )}
        </View>
      </View>

      {items.length > 0 && !offline && (
        <Text style={styles.hintLongPress}>Mantén presionado un tema para quitarlo del setlist</Text>
      )}

      {offline && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>
            📴 Sin conexión — viendo copia guardada{cachedAt ? ` (${new Date(cachedAt).toLocaleString()})` : ''}
          </Text>
        </View>
      )}

      {/* Barra de Director en vivo */}
      {isDirector && !offline && (
        <View style={styles.liveBar}>
          {liveIsThisSetlist ? (
            <>
              <View style={styles.liveDotRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  En vivo: {items[liveIndex]?.song?.title ?? '...'}
                </Text>
              </View>
              <Text style={styles.followCount}>
                👥 {followingCount} de {Math.max(totalOnline - 1, followingCount)} siguiendo en este momento
              </Text>
              <View style={styles.liveControls}>
                <Pressable style={styles.liveBtn} onPress={() => liveStep(-1)} disabled={liveIndex <= 0}>
                  <Text style={styles.liveBtnText}>◂ Anterior</Text>
                </Pressable>
                <Pressable style={styles.liveBtn} onPress={() => liveStep(1)} disabled={liveIndex >= items.length - 1}>
                  <Text style={styles.liveBtnText}>Siguiente ▸</Text>
                </Pressable>
                <Pressable style={styles.liveStopBtn} onPress={stop}>
                  <Text style={styles.liveStopText}>Finalizar</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              style={styles.startLiveBtn}
              onPress={() => (items.length ? startLiveAt(0) : showAlert('Agrega temas primero'))}
            >
              <Text style={styles.startLiveText}>🔴 Iniciar transmisión en vivo</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Aviso para seguidores (no directores) */}
      {!isDirector && liveIsThisSetlist && (
        <Pressable style={styles.followBanner} onPress={goToLiveSong}>
          <View style={styles.liveDot} />
          <Text style={styles.followBannerText}>
            En vivo ahora: {items[liveIndex]?.song?.title ?? '...'} — toca para seguir
          </Text>
        </Pressable>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing(4) }}
        ListEmptyComponent={<Text style={styles.empty}>Agrega el primer tema al setlist.</Text>}
        renderItem={({ item, index }) => {
          const isLiveHere = liveIsThisSetlist && index === liveIndex;
          return (
            <Pressable
              style={[styles.card, isLiveHere && styles.cardLive]}
              onPress={() => router.push(`/(app)/song/${item.song_id}?setlistSongId=${item.id}`)}
              onLongPress={() => removeFromSetlist(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {isLiveHere ? '🔴 ' : ''}{index + 1}. {item.song?.title}
                </Text>
                <Text style={styles.cardMeta}>
                  Tono: {item.transposed_key ?? item.song?.original_key}
                  {item.transposed_key ? ` (original ${item.song?.original_key})` : ''}
                </Text>
              </View>
              {isDirector && (
                <View style={styles.reorderCol}>
                  <Pressable onPress={() => moveItem(index, -1)} hitSlop={8}>
                    <Text style={styles.reorderBtn}>▲</Text>
                  </Pressable>
                  <Pressable onPress={() => moveItem(index, 1)} hitSlop={8}>
                    <Text style={styles.reorderBtn}>▼</Text>
                  </Pressable>
                </View>
              )}
              {isDirector && liveIsThisSetlist && !isLiveHere && (
                <Pressable style={styles.jumpBtn} onPress={() => startLiveAt(index)} hitSlop={8}>
                  <Text style={styles.jumpBtnText}>Ir aquí</Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => setAddModal(true)} disabled={offline}>
        <Text style={styles.fabText}>{offline ? 'Sin conexión' : '+ Agregar tema'}</Text>
      </Pressable>

      <Modal visible={addModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo tema</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Título de la canción"
              placeholderTextColor={colors.textMuted}
              value={songTitle}
              onChangeText={setSongTitle}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Tonalidad original (ej: G, Am, Bb)"
              placeholderTextColor={colors.textMuted}
              value={songKey}
              onChangeText={setSongKey}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={createAndAddSong}>
                <Text style={styles.modalConfirmText}>Agregar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing(5), paddingTop: spacing(14) },
  back: { color: colors.textMuted, marginBottom: spacing(3) },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: spacing(1) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing(1) },
  exportLink: { color: colors.accentChord, fontSize: 12, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing(8) },
  hintLongPress: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: spacing(2) },

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

  liveBar: {
    marginHorizontal: spacing(4),
    marginBottom: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(2) },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginRight: spacing(2) },
  liveText: { color: colors.text, fontWeight: '700' },
  followCount: { color: colors.textMuted, fontSize: 12, marginBottom: spacing(2) },
  liveControls: { flexDirection: 'row', gap: spacing(2) },
  liveBtn: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: spacing(2), alignItems: 'center' },
  liveBtnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  liveStopBtn: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: spacing(2), paddingHorizontal: spacing(3), alignItems: 'center' },
  liveStopText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  startLiveBtn: { alignItems: 'center', paddingVertical: spacing(2) },
  startLiveText: { color: colors.primary, fontWeight: '700' },

  followBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing(4),
    marginBottom: spacing(3),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.danger,
  },
  followBannerText: { color: colors.text, fontWeight: '600', fontSize: 13, flex: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLive: { borderColor: colors.danger, borderWidth: 1.5 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, marginTop: spacing(1), fontSize: 13 },
  reorderCol: { justifyContent: 'space-between', alignItems: 'center', height: 40 },
  reorderBtn: { color: colors.primary, fontSize: 14, paddingHorizontal: spacing(2) },
  jumpBtn: { backgroundColor: colors.primaryMuted, borderRadius: radius.sm, paddingVertical: spacing(1.5), paddingHorizontal: spacing(2.5), marginLeft: spacing(2) },
  jumpBtnText: { color: colors.text, fontSize: 11, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: spacing(6) + webSafeBottom,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(6),
  },
  fabText: { color: '#12121A', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: spacing(6) },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5) },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing(4) },
  modalInput: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing(3), color: colors.text, marginBottom: spacing(3) },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(5) },
  modalCancel: { color: colors.textMuted, padding: spacing(2) },
  modalConfirm: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing(2), paddingHorizontal: spacing(4) },
  modalConfirmText: { color: '#12121A', fontWeight: '700' },
});
