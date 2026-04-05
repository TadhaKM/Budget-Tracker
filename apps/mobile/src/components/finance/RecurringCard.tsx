import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card } from '@/components/ui/Card';
import { colors, categoryIcons } from '@/lib/theme';
import { formatCurrency, formatDateShort } from '@/lib/format';

export interface RecurringData {
  id: string;
  merchantName: string;
  amount: number;
  frequency: string;
  categoryId: string;
  nextExpectedAt?: string | null;
  isActive?: boolean;
}

interface RecurringCardProps {
  item: RecurringData;
  onPress?: (id: string) => void;
}

const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Weekly',
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

export function RecurringCard({ item, onPress }: RecurringCardProps) {
  const { id, merchantName, amount, frequency, categoryId, nextExpectedAt } = item;
  const color = colors.category[categoryId] ?? colors.category.OTHER;
  const iconName = (categoryIcons[categoryId] ?? 'more-horiz') as keyof typeof MaterialIcons.glyphMap;

  return (
    <Pressable onPress={() => onPress?.(id)} disabled={!onPress}>
      <Card className="mb-3">
        <View className="flex-row items-center">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: `${color}20` }}
          >
            <MaterialIcons name={iconName} size={20} color={color} />
          </View>

          <View className="flex-1">
            <Text className="text-white font-medium">{merchantName}</Text>
            <Text className="text-slate-500 text-xs mt-0.5">
              {frequencyLabels[frequency] ?? frequency}
              {nextExpectedAt && ` · Next: ${formatDateShort(nextExpectedAt)}`}
            </Text>
          </View>

          <Text className="text-white font-semibold text-base">
            {formatCurrency(Math.abs(amount))}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
