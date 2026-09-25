import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Switch, Modal } from 'react-native';
import { showAlert } from '@/lib/alert';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';

const INSTRUMENTS = ['Voz', 'Guitarra', 'Bajo', 'Batería', 'Piano/Teclado', 'Otro'];
const DELETE_CONFIRM_WORD = 'ELIMINAR';

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [instrument, setInstrument] = useState<string | null>(null);
  const [notifyNewSong, setNotifyNewSong] = useState(true);
  const [notifyLive, setNotifyLive] = useState(true);
  const [notifyComment, setNotifyComment] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? '');
      setInstrument(profile.instrument ?? null);
      setNotifyNewSong(profile.notify_new_song ?? true);
      setNotifyLive(profile.notify_live_session ?? true);
      setNotifyComment(profile.notify_comment ?? true);
    }
  }, [profile]);

  const save = async () => {
    if (!session?.user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        instrument,
        notify_new_song: notifyNewSong,
        notify_live_session: notifyLive,
        notify_comment: notifyComment,
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      showAlert('No se pudo guardar', friendlyError(error));
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account');
    setDeleting(false);
    if (error) {
      showAlert(
        'No se pudo eliminar',
        friendlyError(error) +
          '\n\nSi este error persiste, puede ser que la función de eliminar cuenta todavía no esté desplegada en el servidor.'
      );
      return;
    }
    setDeleteModal(false);
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Mi perfil</Text>
      </View>

      <Text style={styles.label}>Nombre a mostrar</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ej: Nery - Voz"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Instrumento / rol</Text>
      <View style={styles.chipsRow}>
        {INSTRUMENTS.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.chip, instrument === opt && styles.chipActive]}
            onPress={() => setInstrument(opt === instrument ? null : opt)}
          >
            <Text style={[styles.chipText, instrument === opt && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Notificaciones</Text>
      <View style={styles.notifRow}>
        <Text style={styles.notifLabel}>Nuevos temas en setlists</Text>
        <Switch value={notifyNewSong} onValueChange={setNotifyNewSong} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.notifRow}>
        <Text style={styles.notifLabel}>Transmisiones en vivo</Text>
        <Switch value={notifyLive} onValueChange={setNotifyLive} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.notifRow}>
        <Text style={styles.notifLabel}>Comentarios nuevos</Text>
        <Switch value={notifyComment} onValueChange={setNotifyComment} trackColor={{ true: colors.primary }} />
      </View>

      <Pressable style={[styles.saveBtn, { marginTop: spacing(6) }]} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}</Text>
      </Pressable>

      <Text style={styles.email}>{session?.user?.email}</Text>

      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Zona de peligro</Text>
        <Text style={styles.dangerBody}>
          Esto borra tu cuenta y tu perfil de forma permanente. Las comunidades que hayas creado NO se borran
          (los demás integrantes las conservan), pero tú pierdes el acceso a todo.
        </Text>
        <Pressable style={styles.dangerBtn} onPress={() => setDeleteModal(true)}>
          <Text style={styles.dangerBtnText}>Eliminar mi cuenta</Text>
        </Pressable>
      </View>

      <Modal visible={deleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Eliminar tu cuenta?</Text>
            <Text style={styles.modalBody}>
              Esta acción no se puede deshacer. Para confirmar, escribe {DELETE_CONFIRM_WORD} abajo.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={DELETE_CONFIRM_WORD}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={styles.modalCancel}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirmDanger,
                  deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD && { opacity: 0.4 },
                ]}
                onPress={deleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD || deleting}
              >
                <Text style={styles.modalConfirmDangerText}>{deleting ? 'Eliminando...' : 'Eliminar definitivamente'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(5) },
  header: { paddingTop: spacing(10), marginBottom: spacing(6) },
  back: { color: colors.textMuted, marginBottom: spacing(3) },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing(2), textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
    color: colors.text,
    marginBottom: spacing(5),
    fontSize: 16,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(6) },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: spacing(2), paddingHorizontal: spacing(3) },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#12121A' },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing(2.5), borderBottomWidth: 1, borderBottomColor: colors.border },
  notifLabel: { color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing(4), alignItems: 'center' },
  saveBtnText: { color: '#12121A', fontWeight: '700', fontSize: 16 },
  email: { color: colors.textMuted, textAlign: 'center', marginTop: spacing(6), fontSize: 12 },
  dangerZone: { marginTop: spacing(10), borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: spacing(4) },
  dangerTitle: { color: colors.danger, fontWeight: '700', fontSize: 13, marginBottom: spacing(2) },
  dangerBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing(3) },
  dangerBtn: { backgroundColor: colors.danger, borderRadius: radius.sm, padding: spacing(3), alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: spacing(6) },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5) },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing(2) },
  modalBody: { color: colors.textMuted, fontSize: 13, marginBottom: spacing(4), lineHeight: 18 },
  modalInput: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing(3), color: colors.text, marginBottom: spacing(4) },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(5), alignItems: 'center' },
  modalCancel: { color: colors.textMuted, padding: spacing(2) },
  modalConfirmDanger: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: spacing(2), paddingHorizontal: spacing(4) },
  modalConfirmDangerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
