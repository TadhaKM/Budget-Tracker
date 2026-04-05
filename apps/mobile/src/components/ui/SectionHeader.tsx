import { View, Text, Pressable } from 'react-native';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function SectionHeader({ title, actionLabel, onAction, className = '' }: SectionHeaderProps) {
  return (
    <View className={`flex-row justify-between items-center ${className}`}>
      <Text className="text-white font-semibold text-lg">{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-primary-500 text-sm font-medium">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
