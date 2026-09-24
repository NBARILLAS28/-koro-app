import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert } from '@/lib/alert';
import { router } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !password) return showAlert('Faltan datos', 'Completa todos los campos.');
    setBusy(true);
    const { error } = await signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (error) showAlert('No se pudo registrar', friendlyError({ message: error }));
    else router.replace('/(app)/communities');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Crear cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre a mostrar (ej: Nery - Voz)"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Creando...' : 'Crear cuenta'}</Text>
      </Pressable>

      <Pressable style={styles.linkWrap} onPress={() => router.back()}>
        <Text style={styles.link}>Ya tengo cuenta</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing(6) },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing(8) },
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
  linkWrap: { marginTop: spacing(5), alignItems: 'center' },
  link: { color: colors.accentChord, fontSize: 14 },
});
