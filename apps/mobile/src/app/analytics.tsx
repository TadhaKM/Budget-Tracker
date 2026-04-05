import { View, Text, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SummaryCard } from '@/components/finance/SummaryCard';
import { InsightCard } from '@/components/finance/InsightCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorBox } from '@/components/ui/ErrorBox';
import { useDashboard } from '@/hooks/useDashboard';
import { useInsights, useDismissInsight } from '@/hooks/useInsights';
import { formatCurrency, formatPercent } from '@/lib/format';
import { colors } from '@/lib/theme';

export default function AnalyticsScreen() {
  const { data: dashboard, isLoading, isError, refetch } = useDashboard();
  const { data: insights } = useInsights();
  const dismissInsight = useDismissInsight();

  if (isLoading) {
    return (
      <ScreenContainer>
        <Text className="text-2xl font-bold text-white">Analytics</Text>
        <View className="mt-6 gap-4">
          <Skeleton height={120} radius={16} />
          <Skeleton height={120} radius={16} />
          <Skeleton height={80} radius={16} />
        </View>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <Text className="text-2xl font-bold text-white">Analytics</Text>
        <ErrorBox onRetry={refetch} />
      </ScreenContainer>
    );
  }

  const mtd = dashboard?.monthToDate;
  const fvf = dashboard?.fixedVsFlexible;
  const topMerchants = dashboard?.topMerchants ?? [];

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#3b82f6" />}
    >
      <Text className="text-2xl font-bold text-white">Analytics</Text>
      <Text className="text-slate-400 mt-1">Understand where your money goes</Text>

      {/* Month to date */}
      {mtd && (
        <Card className="mt-6">
          <Text className="text-slate-400 text-sm">Month to Date</Text>
          <View className="flex-row justify-between items-end mt-3">
            <View>
              <Text className="text-white text-2xl font-bold">{formatCurrency(mtd.totalSpent)}</Text>
              <Text className="text-slate-500 text-xs mt-1">spent</Text>
            </View>
            <View className="items-end">
              <Text className="text-green-400 text-lg font-semibold">{formatCurrency(mtd.totalEarned)}</Text>
              <Text className="text-slate-500 text-xs mt-1">earned</Text>
            </View>
          </View>
          <View className="flex-row mt-3 pt-3 border-t border-surface-light">
            <Text className="text-slate-500 text-xs">
              {mtd.daysRemaining} days left · avg {formatCurrency(mtd.dailyAverage)}/day
            </Text>
          </View>
        </Card>
      )}

      {/* Fixed vs flexible */}
      {fvf && fvf.total > 0 && (
        <Card className="mt-4">
          <Text className="text-slate-400 text-sm mb-3">Fixed vs Flexible Spending</Text>
          <View className="flex-row h-3 rounded-full overflow-hidden bg-surface-light">
            <View
              style={{
                width: `${(fvf.fixed / fvf.total) * 100}%`,
                backgroundColor: colors.primary[500],
              }}
              className="h-full"
            />
            <View
              style={{
                width: `${(fvf.flexible / fvf.total) * 100}%`,
                backgroundColor: colors.warning,
              }}
              className="h-full"
            />
          </View>
          <View className="flex-row justify-between mt-3">
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-primary-500 mr-2" />
              <Text className="text-slate-400 text-xs">Fixed {formatCurrency(fvf.fixed)}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-warning mr-2" />
              <Text className="text-slate-400 text-xs">Flexible {formatCurrency(fvf.flexible)}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Top merchants */}
      {topMerchants.length > 0 && (
        <View className="mt-6">
          <SectionHeader title="Top Merchants" />
          <Card className="mt-3">
            {topMerchants.slice(0, 5).map((merchant, i) => (
              <View
                key={merchant.name}
                className={`flex-row justify-between items-center py-3 ${
                  i > 0 ? 'border-t border-surface-light' : ''
                }`}
              >
                <View className="flex-row items-center flex-1">
                  <Text className="text-slate-500 text-xs w-6">{i + 1}.</Text>
                  <Text className="text-white" numberOfLines={1}>{merchant.name}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-medium">{formatCurrency(merchant.amount)}</Text>
                  <Text className="text-slate-500 text-xs">{merchant.count} txns</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && (
        <View className="mt-6">
          <SectionHeader title="All Insights" />
          <View className="mt-3">
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={(id) => dismissInsight.mutate(id)}
              />
            ))}
          </View>
        </View>
      )}

      <View className="h-8" />
    </ScreenContainer>
  );
}
