import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: 'bg-surface-light', text: 'text-slate-300' },
  success: { bg: 'bg-green-900/40', text: 'text-green-400' },
  warning: { bg: 'bg-amber-900/40', text: 'text-amber-400' },
  danger: { bg: 'bg-red-900/40', text: 'text-red-400' },
  info: { bg: 'bg-cyan-900/40', text: 'text-cyan-400' },
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];

  return (
    <View className={`${bg} rounded-full px-3 py-1 self-start`}>
      <Text className={`${text} text-xs font-medium`}>{label}</Text>
    </View>
  );
}
