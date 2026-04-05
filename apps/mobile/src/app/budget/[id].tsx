import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useBudgets } from '@/hooks/useBudgets';
import { formatCurrency } from '@/lib/format';
import { colors } from '@/lib/theme';
import { TRANSACTION_CATEGORIES, type TransactionCategory } from '@clearmoney/shared';
import { budgetsApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: budgets, isLoading } = useBudgets();
  const budget = budgets?.find((b) => b.id === id);

  async function handleDelete() {
    Alert.alert('Delete Budget', 'Are you sure you want to remove this budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await budgetsApi.delete(id!);
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            router.back();
          } catch {
            Alert.alert('Error', 'Could not delete budget.');
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <Skeleton height={120} radius={16} />
        <Skeleton height={200} radius={16} style={{ marginTop: 16 }} />
      </ScreenContainer>
    );
  }

  if (!budget) {
    return (
      <ScreenContainer>
        <Text className="text-white text-lg">Budget not found</Text>
      </ScreenContainer>
    );
  }

  const catKey = budget.categoryId as TransactionCategory;
  const category = TRANSACTION_CATEGORIES[catKey];
  const color = colors.category[budget.categoryId] ?? colors.category.OTHER;
  const remaining = Math.max(budget.limitAmount - budget.spentAmount, 0);
  const isOver = budget.spentAmount > budget.limitAmount;

  return (
    <ScreenContainer>
      <Text className="text-2xl font-bold text-white">{category?.label ?? budget.categoryId}</Text>
      <Text className="text-slate-400 mt-1">Budget details</Text>

      <Card className="mt-6 p-6">
        <View className="items-center mb-4">
          <Text className="text-white text-3xl font-bold">
            {formatCurrency(budget.spentAmount)}
          </Text>
          <Text className="text-slate-500 mt-1">
            of {formatCurrency(budget.limitAmount)} budget
          </Text>
        </View>

        <ProgressBar percent={budget.percent} color={color} height={10} />

        <View className="flex-row justify-between mt-4">
          <View>
            <Text className="text-slate-500 text-xs">Spent</Text>
            <Text className="text-white font-semibold">{formatCurrency(budget.spentAmount)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-slate-500 text-xs">{isOver ? 'Over' : 'Remaining'}</Text>
            <Text className={`font-semibold ${isOver ? 'text-red-400' : 'text-green-400'}`}>
              {isOver
                ? formatCurrency(budget.spentAmount - budget.limitAmount)
                : formatCurrency(remaining)}
            </Text>
          </View>
        </View>
      </Card>

      <View className="mt-6">
        <Button title="Delete Budget" variant="secondary" onPress={handleDelete} />
      </View>
    </ScreenContainer>
  );
}
