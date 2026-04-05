import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  className?: string;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, className = '', style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={`bg-surface-light ${className}`}
      style={[{ width, height, borderRadius: radius, opacity }, style]}
    />
  );
}

/** Common skeleton presets for consistent loading states. */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <Animated.View className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '60%' : '100%'}
          style={{ marginBottom: i < lines - 1 ? 8 : 0 }}
        />
      ))}
    </Animated.View>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <Animated.View className={`bg-surface rounded-2xl p-4 ${className}`}>
      <Skeleton width={120} height={12} />
      <Skeleton width={180} height={28} style={{ marginTop: 8 }} />
      <Skeleton width="80%" height={12} style={{ marginTop: 12 }} />
    </Animated.View>
  );
}
