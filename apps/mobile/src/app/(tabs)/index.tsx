import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBox } from '@/components/ui/ErrorBox';
import { Skeleton } from '@/components/ui/Skeleton';
import { BalanceCard } from '@/components/finance/BalanceCard';
import { SummaryCard } from '@/components/finance/SummaryCard';
import { TransactionRow, type TransactionRowData } from '@/components/finance/TransactionRow';
import { InsightCard } from '@/components/finance/InsightCard';
import { BudgetProgressBar } from '@/components/finance/BudgetProgressBar';
import { useDashboard } from '@/hooks/useDashboard';
import { useAccounts } from '@/hooks/useAccounts';
import { useDismissInsight } from '@/hooks/useInsights';
import { useAccountsStore } from '@/stores/accounts';
import { Card } from '@/components/ui/Card';

export default function HomeScreen() {
  const router = useRouter();
  const { data: dashboard, isLoading, isError, refetch } = useDashboard();
  const { data: accounts } = useAccounts();
  const totalBalance = useAccountsStore((s) => s.totalBalance);
  const dismissInsight = useDismissInsight();

  if (isLoading) {
    return (
      <ScreenContainer>
        <Text className="text-2xl font-bold text-white">ClearMoney</Text>
        <Text className="text-slate-400 mt-1">Your money at a glance</Text>
        <View className="mt-6 gap-4">
          <Skeleton height={100} radius={16} />
          <Skeleton height={120} radius={16} />
          <Skeleton height={80} radius={16} />
        </View>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <Text className="text-2xl font-bold text-white">ClearMoney</Text>
        <ErrorBox onRetry={refetch} />
      </ScreenContainer>
    );
  }

  const hasAccounts = (accounts?.length ?? 0) > 0;

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#3b82f6" />}
    >
      <Text className="text-2xl font-bold text-white">ClearMoney</Text>
      <Text className="text-slate-400 mt-1">Your money at a glance</Text>

      {/* Balance */}
      <View className="mt-6">
        <BalanceCard
          totalBalance={totalBalance()}
          accountCount={accounts?.length ?? 0}
          onPress={() => router.push('/(tabs)/settings')}
        />
      </View>

      {!hasAccounts ? (
        <View className="mt-6">
          <EmptyState
            icon="account-balance"
            title="Connect a bank to get started"
            description="Link your bank account to see your balances, transactions, and spending insights."
            actionLabel="Connect Bank"
            onAction={() => router.push('/(tabs)/settings')}
          />
        </View>
      ) : (
        <>
          {/* Weekly summary */}
          {dashboard?.currentWeek && (
            <View className="mt-4">
              <SummaryCard
                title="This Week"
                spent={dashboard.currentWeek.totalSpent}
                earned={dashboard.currentWeek.totalEarned}
              />
            </View>
          )}

          {/* Insights */}
          {dashboard?.insights && dashboard.insights.length > 0 && (
            <View className="mt-6">
              <SectionHeader
                title="Insights"
                actionLabel="See all"
                onAction={() => router.push('/analytics')}
              />
              <View className="mt-3">
                {dashboard.insights.slice(0, 3).map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onDismiss={(id) => dismissInsight.mutate(id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Budget progress */}
          {dashboard?.budgets && dashboard.budgets.length > 0 && (
            <View className="mt-6">
              <SectionHeader
                title="Budgets"
                actionLabel="See all"
                onAction={() => router.push('/(tabs)/budgets')}
              />
              <View className="mt-3">
                {dashboard.budgets.slice(0, 3).map((budget) => (
                  <BudgetProgressBar key={budget.id} budget={budget} />
                ))}
              </View>
            </View>
          )}

          {/* Upcoming bills */}
          {dashboard?.upcomingBills && dashboard.upcomingBills.length > 0 && (
            <View className="mt-6">
              <SectionHeader
                title="Upcoming Bills"
                actionLabel="See all"
                onAction={() => router.push('/(tabs)/subscriptions')}
              />
              <Card className="mt-3">
                {dashboard.upcomingBills.slice(0, 3).map((bill, i) => (
                  <View
                    key={i}
                    className={`flex-row justify-between py-3 ${
                      i > 0 ? 'border-t border-surface-light' : ''
                    }`}
                  >
                    <View>
                      <Text className="text-white">{bill.name}</Text>
                      <Text className="text-slate-500 text-xs mt-0.5">
                        {new Date(bill.nextExpectedAt).toLocaleDateString('en-IE', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <Text className="text-white font-semibold">€{Math.abs(bill.amount).toFixed(2)}</Text>
                  </View>
                ))}
              </Card>
            </View>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
