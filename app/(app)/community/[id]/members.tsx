import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CommunityMember, MemberRole } from '@/types';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/lib/AuthContext';
import { useMemberRole } from '@/lib/useMemberRole';

const ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Admin',
  director: 'Director',
  member: 'Integrante',
};

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { isDirector: canManage } = useMemberRole(id);
  const [members, setMembers] = useState<CommunityMember[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('community_members')
      .select('*, profile:profiles(*)')
      .eq('community_id', id)
      .order('joined_at', { ascending: true });
    setMembers((data as any) ?? []);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeRole = async (member: CommunityMember, newRole: MemberRole) => {
    const { error } = await supabase
      .from('community_members')
      .update({ role: newRole })
      .eq('community_id', id)
      .eq('profile_id', member.profile_id);
    if (error) showAlert('No se pudo cambiar el rol', friendlyError(error));
    else load();
  };

  const removeMember = (member: CommunityMember) => {
    showAlert(
      'Expulsar integrante',
      `¿Quitar a ${member.profile?.display_name ?? 'este integrante'} de la comunidad?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expulsar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('community_members')
              .delete()
              .eq('community_id', id)
              .eq('profile_id', member.profile_id);
            if (error) showAlert('No se pudo expulsar', friendlyError(error));
            else load();
          },
        },
      ]
    );
  };

  const cycleRole = (member: CommunityMember) => {
    if (!canManage) return;
    const isMe = member.profile_id === session?.user?.id;
    if (isMe) {
      showAlert('No permitido', 'No puedes cambiar tu propio rol ni expulsarte desde aquí.');
      return;
    }
    const allOptions: { label: string; role?: MemberRole; destructive?: boolean }[] = [
      { label: 'Hacer Admin', role: 'admin' },
      { label: 'Hacer Director', role: 'director' },
      { label: 'Hacer Integrante', role: 'member' },
      { label: 'Expulsar de la comunidad', destructive: true },
      { label: 'Cancelar' },
    ];
    const options = allOptions.filter((o) => o.role !== member.role);

    showAlert(
      member.profile?.display_name ?? 'Integrante',
      `Rol actual: ${ROLE_LABELS[member.role]}`,
      options.map((o) =>
        o.destructive
          ? { text: o.label, style: 'destructive', onPress: () => removeMember(member) }
          : o.role
          ? { text: o.label, onPress: () => changeRole(member, o.role!) }
          : { text: o.label, style: 'cancel' }
      )
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.back}>‹ Comunidad</Text>
        </Pressable>
        <Text style={styles.title}>Integrantes</Text>
        <Text style={styles.subtitle}>{members.length} en total</Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.profile_id}
        contentContainerStyle={{ padding: spacing(4) }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => cycleRole(item)}
            disabled={!canManage}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.profile?.display_name ?? 'Sin nombre'}
                {item.profile_id === session?.user?.id ? ' (tú)' : ''}
              </Text>
              {item.profile?.instrument ? <Text style={styles.instrument}>{item.profile.instrument}</Text> : null}
            </View>
            <View style={[styles.roleBadge, item.role !== 'member' && styles.roleBadgeHighlight]}>
              <Text style={[styles.roleText, item.role !== 'member' && styles.roleTextHighlight]}>
                {ROLE_LABELS[item.role]}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {!canManage && (
        <Text style={styles.hint}>Solo un admin o director puede cambiar roles o expulsar integrantes.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing(5), paddingTop: spacing(14) },
  back: { color: colors.textMuted, marginBottom: spacing(3) },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: spacing(1) },
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
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  instrument: { color: colors.textMuted, marginTop: spacing(1), fontSize: 13 },
  roleBadge: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: spacing(1.5), paddingHorizontal: spacing(3) },
  roleBadgeHighlight: { backgroundColor: colors.primaryMuted },
  roleText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  roleTextHighlight: { color: colors.text },
  hint: { color: colors.textMuted, textAlign: 'center', padding: spacing(4), fontSize: 12 },
});
