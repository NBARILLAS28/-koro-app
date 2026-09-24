import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Reemplazo de Alert.alert que SÍ funciona en web.
 *
 * Por qué existe esto: react-native-web define Alert.alert como una función
 * vacía ("static alert() {}") — no hace absolutamente nada en el navegador,
 * sin siquiera un warning. Cualquier pantalla que use Alert.alert para
 * mostrar errores o pedir confirmación se queda "sin hacer nada" en la
 * versión web, aunque en el celular funcione perfecto. Esta función usa
 * Alert.alert de verdad en nativo, y cae a los diálogos del navegador
 * (window.alert / window.confirm) en web.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as any);
    return;
  }

  const full = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(full);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Con 2+ botones (ej: "Cancelar" / "Eliminar"), lo más parecido que ofrece
  // el navegador es confirm(): Aceptar dispara el botón que no es "cancel",
  // Cancelar dispara el que sí lo es (si ninguno lo es, no hace nada).
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actionBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[0];
  const confirmed = window.confirm(full);
  if (confirmed) actionBtn?.onPress?.();
  else cancelBtn?.onPress?.();
}
