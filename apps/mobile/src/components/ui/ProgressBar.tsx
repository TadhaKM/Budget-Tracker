import { View } from 'react-native';
import { colors } from '@/lib/theme';

interface ProgressBarProps {
  /** 0–100 */
  percent: number;
  /** Colour of the filled portion. Defaults to primary. */
  color?: string;
  /** Height in px. Default 8. */
  height?: number;
  className?: string;
}

export function ProgressBar({ percent, color, height = 8, className = '' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);

  const barColor =
    color ?? (clamped >= 100 ? colors.danger : clamped >= 80 ? colors.warning : colors.primary[500]);

  return (
    <View
      className={`bg-surface-light overflow-hidden ${className}`}
      style={{ height, borderRadius: height / 2 }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          backgroundColor: barColor,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}
