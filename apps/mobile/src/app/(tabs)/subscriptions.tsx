import { View, Text, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBox } from '@/components/ui/ErrorBox';
import { Skeleton } from '@/components/ui/Skeleton';
import { RecurringCard } from '@/components/finance/RecurringCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useRecurring } from '@/hooks/useRecurring';
import { formatCurrency } from '@/lib/format';
import { useMemo } from 'react';

export default function SubscriptionsScreen() {
  const { data: recurring, isLoading, isError, refetch } = useRecurring();

  const monthlyTotal = useMemo(() => {
    if (!recurring) return 0;
    return recurring.reduce((sum, r) => {
      const abs = Math.abs(r.amount);
      switch (r.frequency) {
        case 'WEEKLY': return sum + abs * 4.33;
        case 'FORTNIGHTLY': return sum + abs * 2.17;
        case 'MONTHLY': return sum + abs;
        case 'QUARTERLY': return sum + abs / 3;
        case 'YEARLY': return sum + abs / 12;
        default: return sum + abs;
      }
    }, 0);
  }, [recurring]);

  const subscriptions = useMemo(
    () => recurring?.filter((r) => r.categoryId === 'SUBSCRIPTIONS') ?? [],
    [recurring],
  );

  const bills = useMemo(
    () => recurring?.filter((r) => r.categoryId !== 'SUBSCRIPTIONS') ?? [],
    [recurring],
  );

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#3b82f6" />}
    >
      <Text className="text-2xl font-bold text-white">Recurring</Text>
      <Text className="text-slate-400 mt-1">Your subscriptions and regular bills</Text>

      {/* Monthly total */}
      <Card className="mt-6 p-6">
        <Text className="text-slate-400 text-sm">Monthly Total</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {formatCurrency(monthlyTotal)}
        </Text>
        <Text className="text-slate-500 text-sm mt-1">per month in recurring charges</Text>
      </Card>

      {isLoading ? (
        <View className="mt-6 gap-3">
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </View>
      ) : isError ? (
        <ErrorBox onRetry={refetch} />
      ) : !recurring || recurring.length === 0 ? (
        <EmptyState
          icon="autorenew"
          title="No recurring payments detected"
          description="We'll automatically find subscriptions and regular bills once you have enough transaction history."
        />
      ) : (
        <>
          {subscriptions.length > 0 && (
            <View className="mt-6">
              <SectionHeader title="Subscriptions" className="mb-3" />
              {subscriptions.map((item) => (
                <RecurringCard key={item.id} item={item} />
              ))}
            </View>
          )}

          {bills.length > 0 && (
            <View className="mt-6">
              <SectionHeader title="Regular Bills" className="mb-3" />
              {bills.map((item) => (
                <RecurringCard key={item.id} item={item} />
              ))}
            </View>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
