import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, Modal } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Song, Setlist } from '@/types';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { useMemberRole } from '@/lib/useMemberRole';

export default function SongsLibraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [addToSetlistModal, setAddToSetlistModal] = useState<Song | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const { isDirector } = useMemberRole(id);

  const search = useCallback(async (term: string) => {
    setLoading(true);
    let q = supabase.from('songs').select('*').eq('community_id', id).order('title', { ascending: true });
    if (term.trim()) {
      q = q.or(`title.ilike.%${term.trim()}%,artist.ilike.%${term.trim()}%`);
    }
    const { data } = await q;
    setSongs(data ?? []);
    setLoading(false);
  }, [id]);

  // Debounce: espera 300ms tras dejar de escribir antes de consultar
  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useFocusEffect(useCallback(() => { search(query); }, []));

  const openAddToSetlist = async (song: Song) => {
    const { data } = await supabase
      .from('setlists')
      .select('*')
      .eq('community_id', id)
      .order('created_at', { ascending: false });
    setSetlists(data ?? []);
    setAddToSetlistModal(song);
  };

  const addToSetlist = async (setlist: Setlist) => {
    if (!addToSetlistModal) return;
    const { count } = await supabase
      .from('setlist_songs')
      .select('*', { count: 'exact', head: true })
      .eq('setlist_id', setlist.id);
    const { error } = await supabase.from('setlist_songs').insert({
      setlist_id: setlist.id,
      song_id: addToSetlistModal.id,
      position: count ?? 0,
    });
    setAddToSetlistModal(null);
    if (error) showAlert('No se pudo agregar', friendlyError(error));
    else showAlert('Listo', `"${addToSetlistModal.title}" se agregó a "${setlist.title}"`);
  };

  const deleteSong = (song: Song) => {
    showAlert(
      'Eliminar canción',
      `"${song.title}" se eliminará de la biblioteca y de todos los setlists donde aparezca. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('songs').delete().eq('id', song.id);
            if (error) showAlert('No se pudo eliminar', friendlyError(error));
            else search(query);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.back}>‹ Comunidad</Text>
        </Pressable>
        <Text style={styles.title}>Biblioteca de canciones</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título o artista..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing(4) }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {query ? 'No se encontraron canciones con ese término.' : 'Aún no hay canciones en esta comunidad.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push(`/(app)/song/${item.id}`)}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.artist ? `${item.artist} · ` : ''}Tono: {item.original_key}
              </Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={() => openAddToSetlist(item)} hitSlop={8}>
              <Text style={styles.addBtnText}>+ Setlist</Text>
            </Pressable>
            {isDirector && (
              <Pressable style={styles.deleteBtn} onPress={() => deleteSong(item)} hitSlop={8}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </Pressable>
            )}
          </View>
        )}
      />

      <Modal visible={!!addToSetlistModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Agregar a un setlist</Text>
            {setlists.length === 0 ? (
              <Text style={styles.empty}>No hay setlists todavía. Crea uno primero.</Text>
            ) : (
              setlists.map((sl) => (
                <Pressable key={sl.id} style={styles.setlistOption} onPress={() => addToSetlist(sl)}>
                  <Text style={styles.setlistOptionText}>{sl.title}</Text>
                </Pressable>
              ))
            )}
            <Pressable onPress={() => setAddToSetlistModal(null)} style={{ marginTop: spacing(3) }}>
              <Text style={styles.modalCancel}>Cerrar</Text>
            </Pressable>
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
  searchRow: { paddingHorizontal: spacing(4), marginBottom: spacing(2) },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    color: colors.text,
  },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing(8) },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2),
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, marginTop: spacing(1), fontSize: 13 },
  addBtn: { backgroundColor: colors.primaryMuted, borderRadius: radius.sm, paddingVertical: spacing(1.5), paddingHorizontal: spacing(2.5) },
  addBtnText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  deleteBtn: { padding: spacing(1) },
  deleteBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: spacing(6) },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5) },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing(4) },
  setlistOption: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing(3), marginBottom: spacing(2) },
  setlistOptionText: { color: colors.text, fontWeight: '600' },
  modalCancel: { color: colors.textMuted, textAlign: 'center' },
});
