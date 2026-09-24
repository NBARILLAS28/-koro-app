import Animated, { useAnimatedStyle, SharedValue, interpolateColor } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme';

export function MetronomeDot({ value, accent }: { value: SharedValue<number>; accent: boolean }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      value.value,
      [0, 1],
      [accent ? 'transparent' : colors.surfaceAlt, colors.primary]
    ),
    borderColor: value.value > 0.5 ? colors.primary : accent ? colors.primaryMuted : colors.border,
    transform: [{ scale: 1 + value.value * 0.35 }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
});
