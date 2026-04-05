import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors, categoryIcons } from '@/lib/theme';
import { formatCurrency, formatRelativeDay } from '@/lib/format';

export interface TransactionRowData {
  id: string;
  description: string;
  amount: number;
  bookedAt: string;
  categoryId: string;
  merchantName?: string | null;
  merchantLogoUrl?: string | null;
}

interface TransactionRowProps {
  transaction: TransactionRowData;
  onPress?: (id: string) => void;
}

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const { id, description, amount, bookedAt, categoryId, merchantName } = transaction;
  const isExpense = amount < 0;
  const color = colors.category[categoryId] ?? colors.category.OTHER;
  const iconName = (categoryIcons[categoryId] ?? 'more-horiz') as keyof typeof MaterialIcons.glyphMap;

  return (
    <Pressable
      className="flex-row items-center py-3 active:opacity-70"
      onPress={() => onPress?.(id)}
    >
      {/* Category icon */}
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: `${color}20` }}
      >
        <MaterialIcons name={iconName} size={20} color={color} />
      </View>

      {/* Description + date */}
      <View className="flex-1 mr-3">
        <Text className="text-white text-base" numberOfLines={1}>
          {merchantName ?? description}
        </Text>
        <Text className="text-slate-500 text-xs mt-0.5">{formatRelativeDay(bookedAt)}</Text>
      </View>

      {/* Amount */}
      <Text className={`text-base font-semibold ${isExpense ? 'text-white' : 'text-green-400'}`}>
        {isExpense ? `-€${Math.abs(amount).toFixed(2)}` : `+€${amount.toFixed(2)}`}
      </Text>
    </Pressable>
  );
}
