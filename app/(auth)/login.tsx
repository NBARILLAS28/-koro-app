import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Link, router } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return showAlert('Faltan datos', 'Ingresa tu correo y contraseña.');
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) showAlert('No se pudo iniciar sesión', friendlyError({ message: error }));
    else router.replace('/(app)/communities');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>KORO</Text>
      <Text style={styles.tagline}>Tu banda, tu tono, tu comunidad</Text>

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
        <Text style={styles.buttonText}>{busy ? 'Entrando...' : 'Entrar'}</Text>
      </Pressable>

      <Link href="/(auth)/forgot-password" asChild>
        <Pressable style={styles.linkWrap}>
          <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
        </Pressable>
      </Link>

      <Link href="/(auth)/signup" asChild>
        <Pressable style={styles.linkWrap}>
          <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing(6) },
  logo: { fontSize: 48, fontWeight: '800', color: colors.primary, textAlign: 'center', letterSpacing: 2 },
  tagline: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing(10), fontSize: 15 },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing(4),
    alignItems: 'center',
    marginTop: spacing(3),
  },
  buttonText: { color: '#12121A', fontWeight: '700', fontSize: 16 },
  linkWrap: { marginTop: spacing(5), alignItems: 'center' },
  link: { color: colors.accentChord, fontSize: 14 },
});
