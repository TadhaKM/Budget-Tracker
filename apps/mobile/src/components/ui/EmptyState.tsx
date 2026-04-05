import { View, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'inbox', title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <View className="bg-surface rounded-full p-4 mb-4">
        <MaterialIcons name={icon} size={32} color="#64748b" />
      </View>
      <Text className="text-slate-300 text-lg font-semibold text-center">{title}</Text>
      {description && (
        <Text className="text-slate-500 text-sm text-center mt-2 max-w-[280px]">{description}</Text>
      )}
      {actionLabel && onAction && (
        <View className="mt-4">
          <Button title={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}
