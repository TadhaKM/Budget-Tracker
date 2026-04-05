import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBox } from '@/components/ui/ErrorBox';
import { Skeleton } from '@/components/ui/Skeleton';
import { BudgetProgressBar } from '@/components/finance/BudgetProgressBar';
import { Card } from '@/components/ui/Card';
import { useBudgets } from '@/hooks/useBudgets';
import { formatCurrency } from '@/lib/format';

export default function BudgetsScreen() {
  const router = useRouter();
  const { data: budgets, isLoading, isError, refetch } = useBudgets();

  const totalLimit = budgets?.reduce((sum, b) => sum + b.limitAmount, 0) ?? 0;
  const totalSpent = budgets?.reduce((sum, b) => sum + b.spentAmount, 0) ?? 0;
  const overallPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#3b82f6" />}
    >
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-white">Budgets</Text>
          <Text className="text-slate-400 mt-1">Set limits, stay in control</Text>
        </View>
        <Pressable
          className="bg-primary-600 rounded-full px-4 py-2 active:opacity-80"
          onPress={() => router.push('/budget/create')}
        >
          <Text className="text-white text-sm font-semibold">+ New</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="mt-6 gap-3">
          <Skeleton height={100} radius={16} />
          <Skeleton height={100} radius={16} />
          <Skeleton height={100} radius={16} />
        </View>
      ) : isError ? (
        <ErrorBox onRetry={refetch} />
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState
          icon="pie-chart"
          title="No budgets set"
          description="Tap '+ New' to set a spending limit for a category. We'll track it automatically."
          actionLabel="Create Budget"
          onAction={() => router.push('/budget/create')}
        />
      ) : (
        <>
          {/* Overall summary */}
          <Card className="mt-6 p-5">
            <Text className="text-slate-400 text-sm">Overall Budget</Text>
            <View className="flex-row justify-between items-end mt-2">
              <Text className="text-white text-2xl font-bold">
                {formatCurrency(totalSpent)}
              </Text>
              <Text className="text-slate-500 text-sm">
                of {formatCurrency(totalLimit)}
              </Text>
            </View>
            <View className="bg-surface-light h-2 rounded-full mt-3 overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(overallPercent, 100)}%`,
                  backgroundColor: overallPercent >= 100 ? '#ef4444' : overallPercent >= 80 ? '#f59e0b' : '#3b82f6',
                }}
              />
            </View>
          </Card>

          {/* Individual budgets */}
          <View className="mt-6">
            {budgets.map((budget) => (
              <BudgetProgressBar
                key={budget.id}
                budget={budget}
                onPress={(id) => router.push(`/budget/${id}`)}
              />
            ))}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}
