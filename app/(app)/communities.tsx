import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Community } from '@/types';
import { colors, radius, spacing } from '@/theme';
import { friendlyError, withRetry } from '@/lib/errors';
import { useToast } from '@/components/Toast';

export default function CommunitiesScreen() {
  const { session, signOut } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [modal, setModal] = useState<'none' | 'create' | 'join'>('none');
  const [inputValue, setInputValue] = useState('');
  const [busy, setBusy] = useState(false);
  const { showToast, Toast } = useToast();

  const load = useCallback(async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await withRetry(async () =>
        supabase.from('community_members').select('community:communities(*)').eq('profile_id', session.user!.id)
      );
      if (!error && data) {
        setCommunities(data.map((row: any) => row.community).filter(Boolean));
      }
    } catch {
      // Sin conexión: dejamos la lista como estaba en memoria, sin bloquear la pantalla.
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const createCommunity = async () => {
    if (!inputValue.trim() || !session?.user) return;
    setBusy(true);
    const { error } = await supabase.from('communities').insert({
      name: inputValue.trim(),
      owner_id: session.user.id,
    });
    setBusy(false);
    setModal('none');
    const name = inputValue.trim();
    setInputValue('');
    if (error) showAlert('No se pudo crear', friendlyError(error));
    else {
      showToast(`"${name}" creada ✓`);
      load();
    }
  };

  const joinCommunity = async () => {
    if (!inputValue.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('join_community_by_code', { p_code: inputValue.trim() });
    setBusy(false);
    setModal('none');
    setInputValue('');
    if (error) showAlert('No se pudo unir', friendlyError(error));
    else {
      showToast('Te uniste a la comunidad ✓');
      load();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>KORO</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/(app)/profile')}>
            <Text style={styles.profileLink}>Mi perfil</Text>
          </Pressable>
          <Pressable onPress={signOut}>
            <Text style={styles.signOut}>Salir</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing(4) }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no perteneces a ninguna comunidad. Crea una o únete con un código.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/(app)/community/${item.id}`)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardCode}>Código: {item.invite_code}</Text>
          </Pressable>
        )}
      />

      <View style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.secondary]} onPress={() => setModal('join')}>
          <Text style={styles.actionTextSecondary}>Unirme con código</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => setModal('create')}>
          <Text style={styles.actionText}>+ Nueva comunidad</Text>
        </Pressable>
      </View>

      <Modal visible={modal !== 'none'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modal === 'create' ? 'Nombre de la comunidad' : 'Código de invitación'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={modal === 'create' ? 'Ej: Banda Alabanza Central' : 'Ej: KORO-7F3A'}
              placeholderTextColor={colors.textMuted}
              autoCapitalize={modal === 'join' ? 'characters' : 'sentences'}
              value={inputValue}
              onChangeText={setInputValue}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setModal('none'); setInputValue(''); }}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={modal === 'create' ? createCommunity : joinCommunity}
                disabled={busy}
              >
                <Text style={styles.modalConfirmText}>{busy ? '...' : 'Confirmar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing(5),
    paddingTop: spacing(14),
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  signOut: { color: colors.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  profileLink: { color: colors.primary, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing(10), paddingHorizontal: spacing(6) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardCode: { color: colors.textMuted, marginTop: spacing(1), fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing(3), padding: spacing(4) },
  actionButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing(4), alignItems: 'center' },
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  actionText: { color: '#12121A', fontWeight: '700' },
  actionTextSecondary: { color: colors.text, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: spacing(6) },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5) },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing(4) },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing(3),
    color: colors.text,
    marginBottom: spacing(4),
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(5) },
  modalCancel: { color: colors.textMuted, padding: spacing(2) },
  modalConfirm: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing(2), paddingHorizontal: spacing(4) },
  modalConfirmText: { color: '#12121A', fontWeight: '700' },
});
