import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { ErrorBox } from '@/components/ui/ErrorBox';
import { Skeleton } from '@/components/ui/Skeleton';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccountsStore } from '@/stores/accounts';
import { formatCurrency } from '@/lib/format';
import { useMemo } from 'react';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const account = accounts?.find((a) => a.id === id);

  const { data, isLoading: txnLoading, isError, refetch, fetchNextPage, hasNextPage } =
    useTransactions({ accountId: id });

  const transactions = useMemo(
    () => data?.pages.flatMap((p) => p.transactions) ?? [],
    [data],
  );

  if (accountsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background p-4">
        <Skeleton height={120} radius={16} />
        <View className="mt-6 gap-4">
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (!account) {
    return (
      <SafeAreaView className="flex-1 bg-background p-4">
        <ErrorBox message="Account not found" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-4"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#3b82f6" />}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <Card className="p-6 mt-4">
              <Text className="text-slate-400 text-sm">{account.bankName}</Text>
              <Text className="text-white text-xl font-semibold mt-1">{account.accountName}</Text>
              <Text className="text-white text-3xl font-bold mt-2">
                {formatCurrency(account.balance)}
              </Text>
              <Text className="text-slate-500 text-xs mt-2">
                {account.accountType} · {account.currency}
              </Text>
            </Card>

            <SectionHeader title="Recent Transactions" className="mt-6 mb-2" />

            {txnLoading && (
              <View className="gap-4">
                <Skeleton height={48} radius={12} />
                <Skeleton height={48} radius={12} />
                <Skeleton height={48} radius={12} />
              </View>
            )}

            {!txnLoading && transactions.length === 0 && (
              <EmptyState
                icon="receipt-long"
                title="No transactions"
                description="Transactions will appear here after your account syncs."
              />
            )}
          </>
        }
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            onPress={(txnId) => router.push(`/transaction/${txnId}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}
