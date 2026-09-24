/**
 * Traduce errores comunes de Supabase/red a mensajes claros para el usuario.
 * Si no reconoce el error, devuelve el mensaje original (mejor que ocultarlo).
 */
export function friendlyError(error: unknown): string {
  const raw = (error as any)?.message ?? String(error ?? '');
  const msg = raw.toLowerCase();

  if (msg.includes('failed to fetch') || msg.includes('network request failed') || msg.includes('networkerror')) {
    return 'No hay conexión a internet. Revisa tu wifi/datos e intenta de nuevo.';
  }
  if (msg.includes('código de invitación inválido')) {
    return 'Ese código no corresponde a ninguna comunidad. Verifica que esté bien escrito (sin espacios).';
  }
  if (msg.includes('alcanzó el máximo')) {
    return raw; // ya viene en español y es claro tal cual
  }
  if (msg.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.';
  }
  if (msg.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return 'Ese correo no parece válido. Revísalo e intenta de nuevo.';
  }
  if (msg.includes('jwt') || msg.includes('token') || msg.includes('refresh_token_not_found')) {
    return 'Tu sesión expiró. Cierra sesión y vuelve a entrar.';
  }
  if (msg.includes('no puedes quitar al único admin')) {
    return raw;
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'La operación tardó demasiado. Intenta de nuevo en unos segundos.';
  }

  return raw || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/**
 * Reintenta una función asíncrona hasta `retries` veces con espera creciente entre intentos.
 * Útil para llamadas de red que pueden fallar por una mala conexión momentánea.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 600
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
