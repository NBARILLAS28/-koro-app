import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, Modal } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { Community, Setlist, CommunityMember } from '@/types';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/lib/AuthContext';

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [modal, setModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    const [{ data: c }, { data: sl }, { data: mem }] = await Promise.all([
      supabase.from('communities').select('*').eq('id', id).single(),
      supabase.from('setlists').select('*').eq('community_id', id).order('created_at', { ascending: false }),
      supabase.from('community_members').select('*, profile:profiles(*)').eq('community_id', id),
    ]);
    setCommunity(c ?? null);
    setSetlists(sl ?? []);
    setMembers(mem ?? []);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copyCode = async () => {
    if (!community) return;
    await Clipboard.setStringAsync(community.invite_code);
    showAlert('Copiado', `Código ${community.invite_code} copiado al portapapeles.`);
  };

  const createSetlist = async () => {
    if (!newTitle.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('setlists').insert({
      community_id: id,
      title: newTitle.trim(),
      created_by: userData.user?.id,
    });
    setModal(false);
    setNewTitle('');
    if (error) showAlert('Error', friendlyError(error));
    else load();
  };

  const deleteSetlist = (setlist: Setlist) => {
    showAlert(
      'Eliminar setlist',
      `"${setlist.title}" se eliminará junto con el orden de canciones que tenía. Las canciones seguirán en la biblioteca. Mantén presionado para confirmar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('setlists').delete().eq('id', setlist.id);
            if (error) showAlert('No se pudo eliminar', friendlyError(error));
            else load();
          },
        },
      ]
    );
  };

  const leaveCommunity = () => {
    if (!session?.user || !community) return;
    showAlert(
      'Salir de la comunidad',
      `¿Seguro que quieres salir de "${community.name}"? Necesitarás el código de invitación para volver a entrar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('community_members')
              .delete()
              .eq('community_id', id)
              .eq('profile_id', session.user!.id);
            if (error) showAlert('No se pudo salir', friendlyError(error));
            else router.replace('/(app)/communities');
          },
        },
      ]
    );
  };

  if (!community) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.back}>‹ Comunidades</Text>
        </Pressable>
        <Text style={styles.title}>{community.name}</Text>
        <View style={styles.chipRow}>
          <Pressable style={styles.codeChip} onPress={copyCode}>
            <Text style={styles.codeChipText}>{community.invite_code}</Text>
          </Pressable>
          <Pressable style={styles.membersChip} onPress={() => router.push(`/(app)/community/${id}/members`)}>
            <Text style={styles.membersChipText}>👥 {members.length}/{community.max_members}</Text>
          </Pressable>
        </View>
        <Pressable onPress={leaveCommunity} style={styles.leaveLink}>
          <Text style={styles.leaveLinkText}>Salir de la comunidad</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Setlists</Text>
        <Pressable onPress={() => setModal(true)}>
          <Text style={styles.addLink}>+ Nuevo</Text>
        </Pressable>
      </View>

      <Pressable style={styles.libraryLink} onPress={() => router.push(`/(app)/community/${id}/songs`)}>
        <Text style={styles.libraryLinkText}>🔍 Buscar en la biblioteca de canciones</Text>
      </Pressable>

      <FlatList
        data={setlists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing(4) }}
        ListEmptyComponent={<Text style={styles.empty}>Sin setlists todavía. Crea el primero para tu próximo ensayo.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(app)/setlist/${item.id}`)}
            onLongPress={() => deleteSetlist(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.event_date ? <Text style={styles.cardMeta}>{item.event_date}</Text> : null}
            </View>
          </Pressable>
        )}
      />

      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nombre del setlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Ensayo martes"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={createSetlist}>
                <Text style={styles.modalConfirmText}>Crear</Text>
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
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  codeChip: {
    marginTop: spacing(2),
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
  },
  codeChipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  chipRow: { flexDirection: 'row', gap: spacing(2) },
  leaveLink: { marginTop: spacing(3) },
  leaveLinkText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  membersChip: {
    marginTop: spacing(2),
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
  },
  membersChipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing(5), marginTop: spacing(3), marginBottom: spacing(2) },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  addLink: { color: colors.primary, fontWeight: '600' },
  libraryLink: { paddingHorizontal: spacing(5), marginBottom: spacing(3) },
  libraryLinkText: { color: colors.accentChord, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing(8) },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(4), marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, marginTop: spacing(1), fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: spacing(6) },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5) },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing(4) },
  modalInput: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing(3), color: colors.text, marginBottom: spacing(4) },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(5) },
  modalCancel: { color: colors.textMuted, padding: spacing(2) },
  modalConfirm: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing(2), paddingHorizontal: spacing(4) },
  modalConfirmText: { color: '#12121A', fontWeight: '700' },
});
