import { View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { Divider } from '@/components/ui/Divider';
import { formatCurrency, formatDateLong } from '@/lib/format';
import { colors, categoryIcons } from '@/lib/theme';
import { TRANSACTION_CATEGORIES, CATEGORY_LIST, type TransactionCategory } from '@clearmoney/shared';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { transactionsApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // In production, this would come from a useTransaction(id) hook.
  // For now, show the detail layout with placeholder data.
  const [transaction] = useState({
    id: id ?? '',
    description: 'Transaction',
    amount: -12.50,
    bookedAt: new Date().toISOString(),
    categoryId: 'OTHER' as string,
    merchantName: null as string | null,
    accountName: 'Current Account',
  });

  const isExpense = transaction.amount < 0;
  const categoryId = transaction.categoryId as TransactionCategory;
  const category = TRANSACTION_CATEGORIES[categoryId];
  const color = colors.category[transaction.categoryId] ?? colors.category.OTHER;
  const iconName = (categoryIcons[transaction.categoryId] ?? 'more-horiz') as keyof typeof MaterialIcons.glyphMap;

  async function handleCategoryChange(newCategoryId: string) {
    try {
      await transactionsApi.updateCategory(transaction.id, newCategoryId);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowCategoryPicker(false);
    } catch {
      Alert.alert('Error', 'Could not update category. Please try again.');
    }
  }

  return (
    <ScreenContainer>
      {/* Amount hero */}
      <View className="items-center mt-4">
        <View
          className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
          style={{ backgroundColor: `${color}20` }}
        >
          <MaterialIcons name={iconName} size={32} color={color} />
        </View>
        <Text className={`text-3xl font-bold ${isExpense ? 'text-white' : 'text-green-400'}`}>
          {formatCurrency(transaction.amount, true)}
        </Text>
        <Text className="text-slate-400 mt-1">
          {transaction.merchantName ?? transaction.description}
        </Text>
      </View>

      {/* Details */}
      <Card className="mt-6">
        <View className="flex-row justify-between py-2">
          <Text className="text-slate-400">Date</Text>
          <Text className="text-white">{formatDateLong(transaction.bookedAt)}</Text>
        </View>
        <Divider />
        <View className="flex-row justify-between py-2">
          <Text className="text-slate-400">Account</Text>
          <Text className="text-white">{transaction.accountName}</Text>
        </View>
        <Divider />
        <View className="flex-row justify-between py-2">
          <Text className="text-slate-400">Description</Text>
          <Text className="text-white flex-shrink" numberOfLines={2}>
            {transaction.description}
          </Text>
        </View>
        <Divider />
        <View className="flex-row justify-between items-center py-2">
          <Text className="text-slate-400">Category</Text>
          <Pressable
            className="flex-row items-center"
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Badge label={category?.label ?? transaction.categoryId} />
            <MaterialIcons name="edit" size={14} color="#64748b" style={{ marginLeft: 6 }} />
          </Pressable>
        </View>
      </Card>

      {/* Category picker */}
      {showCategoryPicker && (
        <Card className="mt-4">
          <Text className="text-white font-semibold mb-3">Change Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORY_LIST.map((cat) => (
              <CategoryChip
                key={cat.key}
                categoryId={cat.key}
                selected={cat.key === categoryId}
                onPress={() => handleCategoryChange(cat.key)}
              />
            ))}
          </View>
        </Card>
      )}

      <View className="h-8" />
    </ScreenContainer>
  );
}
