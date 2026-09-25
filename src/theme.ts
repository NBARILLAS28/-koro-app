// Paleta KORO — oscuro, cálido, con acento dorado (guiño al "Oro" del nombre)
import { Platform } from 'react-native';

export const colors = {
  background: '#12121A',
  surface: '#1C1C28',
  surfaceAlt: '#25253A',
  border: '#33334A',
  text: '#F4F1EA',
  textMuted: '#9A97A8',
  primary: '#E8B84B', // dorado — Key + Oro
  primaryMuted: '#8A6E2A',
  accentChord: '#6FB8E0', // color para acordes, contraste con letra
  danger: '#E05C5C',
  success: '#5CC88A',
};

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
};

// El plan gratis de Netlify agrega un badge flotante "Powered by Netlify"
// fijo abajo a la derecha de la pantalla, que no existe en la app nativa
// (solo aparece en la versión web). Este extra empuja hacia arriba cualquier
// botón/barra que tengamos anclado al fondo de la pantalla en web, para que
// el badge de Netlify no lo tape.
export const webSafeBottom = Platform.OS === 'web' ? 64 : 0;

