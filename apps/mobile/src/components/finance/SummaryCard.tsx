import { View, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/format';

interface SummaryCardProps {
  title: string;
  spent: number;
  earned: number;
  /** Percentage change compared to previous period. */
  changePct?: number | null;
}

export function SummaryCard({ title, spent, earned, changePct }: SummaryCardProps) {
  const netFlow = earned - spent;

  return (
    <Card>
      <Text className="text-slate-400 text-sm">{title}</Text>

      <View className="flex-row justify-between items-end mt-3">
        <View>
          <Text className="text-white text-2xl font-bold">{formatCurrency(spent)}</Text>
          <Text className="text-slate-500 text-xs mt-1">spent</Text>
        </View>
        <View className="items-end">
          <Text className="text-green-400 text-lg font-semibold">
            {formatCurrency(earned)}
          </Text>
          <Text className="text-slate-500 text-xs mt-1">earned</Text>
        </View>
      </View>

      {changePct !== undefined && changePct !== null && (
        <View className="flex-row items-center mt-3 pt-3 border-t border-surface-light">
          <MaterialIcons
            name={changePct <= 0 ? 'trending-down' : 'trending-up'}
            size={16}
            color={changePct <= 0 ? '#22c55e' : '#ef4444'}
          />
          <Text
            className={`text-xs font-medium ml-1 ${changePct <= 0 ? 'text-green-400' : 'text-red-400'}`}
          >
            {Math.abs(changePct).toFixed(1)}% vs last week
          </Text>
        </View>
      )}
    </Card>
  );
}
