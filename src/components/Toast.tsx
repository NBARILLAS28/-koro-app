import { useCallback, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '@/theme';

/**
 * Hook + componente de confirmación visual. Uso:
 *   const { showToast, Toast } = useToast();
 *   showToast('Comentario enviado ✓');
 *   ...
 *   return <View>...<Toast /></View>
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, durationMs = 1800) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(msg);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timeoutRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
        setMessage(null)
      );
    }, durationMs);
  }, [opacity]);

  const Toast = useCallback(() => {
    if (!message) return null;
    return (
      <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    );
  }, [message, opacity]);

  return { showToast, Toast };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: spacing(8),
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(5),
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  toastText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
