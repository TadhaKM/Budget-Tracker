import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors, categoryIcons } from '@/lib/theme';
import { TRANSACTION_CATEGORIES, type TransactionCategory } from '@clearmoney/shared';

interface CategoryChipProps {
  categoryId: TransactionCategory;
  selected?: boolean;
  onPress?: () => void;
  showIcon?: boolean;
}

export function CategoryChip({ categoryId, selected = false, onPress, showIcon = true }: CategoryChipProps) {
  const category = TRANSACTION_CATEGORIES[categoryId];
  const color = colors.category[categoryId] ?? colors.category.OTHER;
  const iconName = (categoryIcons[categoryId] ?? 'more-horiz') as keyof typeof MaterialIcons.glyphMap;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-full px-3 py-1.5 mr-2 ${
        selected ? 'border border-primary-500 bg-primary-500/20' : 'bg-surface'
      }`}
      disabled={!onPress}
    >
      {showIcon && (
        <View className="mr-1.5">
          <MaterialIcons name={iconName} size={14} color={selected ? colors.primary[500] : color} />
        </View>
      )}
      <Text
        className={`text-xs font-medium ${selected ? 'text-primary-500' : 'text-slate-300'}`}
      >
        {category?.label ?? categoryId}
      </Text>
    </Pressable>
  );
}
