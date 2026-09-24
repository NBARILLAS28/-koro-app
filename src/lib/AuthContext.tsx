import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data, error }) => {
        if (data) {
          setProfile(data);
          return;
        }
        // Red de seguridad: si por alguna razón el trigger del servidor no
        // alcanzó a crear el perfil, lo creamos aquí para no dejar la cuenta
        // en un estado roto (sin esto, cualquier acción que dependa de
        // "profiles" fallaría con un error de foreign key confuso).
        if (error?.code === 'PGRST116') {
          const fallbackName =
            (session.user.user_metadata as any)?.display_name ??
            session.user.email?.split('@')[0] ??
            'Usuario';
          const { data: created } = await supabase
            .from('profiles')
            .upsert({ id: session.user.id, display_name: fallbackName })
            .select()
            .single();
          setProfile(created ?? null);
        }
      });
  }, [session?.user?.id]);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue['signUp'] = async (email, password, displayName) => {
    // El nombre se guarda como metadata de auth; un trigger en el servidor
    // (ver migración 007) crea la fila en "profiles" automáticamente,
    // sin depender de que la sesión del cliente ya esté lista para RLS.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Envía el correo de recuperación. El link dentro del correo abre la app
  // (koro://reset-password) directo en la pantalla de nueva contraseña.
  const requestPasswordReset: AuthContextValue['requestPasswordReset'] = async (email) => {
    // En el celular, el enlace del correo debe abrir la app (esquema koro://).
    // En web, "koro://" no significa nada para un navegador — debe apuntar de
    // vuelta al mismo sitio donde se pidió el reset (origin actual), para que
    // el link del correo abra la página real de "nueva contraseña".
    const redirectTo =
      Platform.OS === 'web' ? `${window.location.origin}/reset-password` : 'koro://reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  };

  // Se usa DESPUÉS de que la pantalla de reset ya estableció la sesión de
  // recuperación a partir del link del correo (ver app/reset-password.tsx).
  const updatePassword: AuthContextValue['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signIn, signUp, signOut, requestPasswordReset, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
