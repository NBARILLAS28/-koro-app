import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert } from '@/lib/alert';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';

export default function ResetPasswordScreen() {
  const url = Linking.useURL();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!url) return;

    // El enlace del correo trae los tokens de recuperación en el fragmento de
    // la URL (después del #), no como parámetro normal — por eso se procesa
    // aquí manualmente en lugar de con los params típicos de la ruta.
    const fragment = url.split('#')[1];
    if (!fragment) {
      setInvalid(true);
      return;
    }

    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
      setInvalid(true);
      return;
    }

    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) setInvalid(true);
      else setReady(true);
    });
  }, [url]);

  const handleSubmit = async () => {
    if (password.length < 6) return showAlert('Contraseña muy corta', 'Debe tener al menos 6 caracteres.');
    if (password !== confirmPassword) return showAlert('No coinciden', 'Las dos contraseñas deben ser iguales.');

    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) showAlert('No se pudo actualizar', friendlyError({ message: error }));
    else {
      showAlert('Listo', 'Tu contraseña se actualizó.', [
        { text: 'OK', onPress: () => router.replace('/(app)/communities') },
      ]);
    }
  };

  if (invalid) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Enlace inválido o vencido</Text>
        <Text style={styles.body}>
          Este enlace ya no sirve (los enlaces de recuperación expiran). Pide uno nuevo desde la pantalla de
          inicio de sesión.
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.buttonText}>Volver a iniciar sesión</Text>
        </Pressable>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Nueva contraseña</Text>
      <Text style={styles.body}>Escribe tu nueva contraseña dos veces para confirmarla.</Text>

      <TextInput
        style={styles.input}
        placeholder="Contraseña nueva"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Repite la contraseña"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Guardando...' : 'Guardar contraseña'}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing(6) },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing(3) },
  body: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing(6), lineHeight: 20 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
    color: colors.text,
    marginBottom: spacing(3),
    fontSize: 16,
  },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing(4), alignItems: 'center', marginTop: spacing(3) },
  buttonText: { color: '#12121A', fontWeight: '700', fontSize: 16 },
});
