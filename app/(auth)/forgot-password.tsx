import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { showAlert } from '@/lib/alert';
import { router } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return showAlert('Falta tu correo', 'Escribe el correo con el que te registraste.');
    setBusy(true);
    const { error } = await requestPasswordReset(email.trim());
    setBusy(false);
    if (error) showAlert('No se pudo enviar', friendlyError({ message: error }));
    else setSent(true);
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.body}>
          Te enviamos un enlace a <Text style={{ color: colors.primary }}>{email}</Text> para crear una
          contraseña nueva. Ábrelo desde tu iPhone — te va a llevar directo de vuelta a KORO.
        </Text>
        <Pressable style={styles.linkWrap} onPress={() => router.back()}>
          <Text style={styles.link}>Volver a iniciar sesión</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Recuperar contraseña</Text>
      <Text style={styles.body}>Escribe el correo con el que te registraste y te mandamos un enlace para crear una contraseña nueva.</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Enviando...' : 'Enviar enlace'}</Text>
      </Pressable>

      <Pressable style={styles.linkWrap} onPress={() => router.back()}>
        <Text style={styles.link}>Volver a iniciar sesión</Text>
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
    marginBottom: spacing(4),
    fontSize: 16,
  },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing(4), alignItems: 'center' },
  buttonText: { color: '#12121A', fontWeight: '700', fontSize: 16 },
  linkWrap: { marginTop: spacing(5), alignItems: 'center' },
  link: { color: colors.accentChord, fontSize: 14 },
});
