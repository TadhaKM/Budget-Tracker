import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors, categoryIcons } from '@/lib/theme';
import { formatCurrency } from '@/lib/format';
import { TRANSACTION_CATEGORIES, type TransactionCategory } from '@clearmoney/shared';

export interface BudgetData {
  id: string;
  categoryId: string;
  limitAmount: number;
  spentAmount: number;
  percent: number;
}

interface BudgetProgressBarProps {
  budget: BudgetData;
  onPress?: (id: string) => void;
}

export function BudgetProgressBar({ budget, onPress }: BudgetProgressBarProps) {
  const { id, categoryId, limitAmount, spentAmount, percent } = budget;
  const remaining = Math.max(limitAmount - spentAmount, 0);
  const isOver = spentAmount > limitAmount;

  const catKey = categoryId as TransactionCategory;
  const category = TRANSACTION_CATEGORIES[catKey];
  const color = colors.category[categoryId] ?? colors.category.OTHER;
  const iconName = (categoryIcons[categoryId] ?? 'more-horiz') as keyof typeof MaterialIcons.glyphMap;

  return (
    <Pressable onPress={() => onPress?.(id)} disabled={!onPress}>
      <Card className="mb-3">
        <View className="flex-row items-center mb-3">
          <View
            className="w-8 h-8 rounded-lg items-center justify-center mr-2.5"
            style={{ backgroundColor: `${color}20` }}
          >
            <MaterialIcons name={iconName} size={16} color={color} />
          </View>
          <Text className="text-white font-medium flex-1">
            {category?.label ?? categoryId}
          </Text>
          {isOver && (
            <View className="bg-red-900/40 rounded-full px-2 py-0.5">
              <Text className="text-red-400 text-xs font-medium">Over budget</Text>
            </View>
          )}
        </View>

        <ProgressBar percent={percent} color={color} />

        <View className="flex-row justify-between mt-2">
          <Text className="text-slate-500 text-xs">
            {formatCurrency(spentAmount)} of {formatCurrency(limitAmount)}
          </Text>
          <Text className={`text-xs font-medium ${isOver ? 'text-red-400' : 'text-slate-400'}`}>
            {isOver
              ? `€${(spentAmount - limitAmount).toFixed(2)} over`
              : `€${remaining.toFixed(2)} left`}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
