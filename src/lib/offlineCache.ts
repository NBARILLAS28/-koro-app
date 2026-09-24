import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'koro:cache:';

/** Guarda cualquier dato serializable bajo una clave, con timestamp de cuándo se guardó. */
export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PREFIX + key,
      JSON.stringify({ data, cachedAt: new Date().toISOString() })
    );
  } catch {
    // Si falla el guardado en caché no interrumpimos el flujo principal de la app.
  }
}

/** Recupera datos cacheados. Devuelve null si no hay nada guardado para esa clave. */
export async function cacheGet<T>(key: string): Promise<{ data: T; cachedAt: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Claves usadas por las pantallas de setlist y canción */
export const cacheKeys = {
  setlist: (setlistId: string) => `setlist:${setlistId}`,
  setlistSongs: (setlistId: string) => `setlist_songs:${setlistId}`,
  song: (songId: string) => `song:${songId}`,
  comments: (songId: string) => `comments:${songId}`,
};
