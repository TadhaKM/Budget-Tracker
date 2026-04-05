import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TransactionRow, type TransactionRowData } from '@/components/finance/TransactionRow';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBox } from '@/components/ui/ErrorBox';
import { Skeleton } from '@/components/ui/Skeleton';
import { Divider } from '@/components/ui/Divider';
import { useTransactions } from '@/hooks/useTransactions';
import { CATEGORY_LIST, type TransactionCategory } from '@clearmoney/shared';
import { formatRelativeDay } from '@/lib/format';

export default function TransactionsScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filters = useMemo(
    () => (selectedCategory ? { category: selectedCategory } : undefined),
    [selectedCategory],
  );

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactions(filters);

  const allTransactions = useMemo(
    () => data?.pages.flatMap((p) => p.transactions) ?? [],
    [data],
  );

  // Group by day
  const sections = useMemo(() => {
    const groups: { title: string; data: TransactionRowData[] }[] = [];
    let currentDay = '';

    for (const txn of allTransactions) {
      const day = formatRelativeDay(txn.bookedAt);
      if (day !== currentDay) {
        currentDay = day;
        groups.push({ title: day, data: [] });
      }
      groups[groups.length - 1].data.push(txn);
    }

    return groups;
  }, [allTransactions]);

  // Flatten for FlatList with section headers
  const flatData = useMemo(() => {
    const items: Array<{ type: 'header'; title: string } | { type: 'txn'; data: TransactionRowData }> = [];
    for (const section of sections) {
      items.push({ type: 'header', title: section.title });
      for (const txn of section.data) {
        items.push({ type: 'txn', data: txn });
      }
    }
    return items;
  }, [sections]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-white">Transactions</Text>
        <Text className="text-slate-400 mt-1">All your accounts, one list</Text>

        {/* Category filter */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...CATEGORY_LIST.map((c) => c.key)]}
          keyExtractor={(item) => item ?? 'all'}
          className="mt-4"
          renderItem={({ item }) => {
            if (item === null) {
              return (
                <Pressable
                  onPress={() => setSelectedCategory(null)}
                  className={`rounded-full px-4 py-1.5 mr-2 ${
                    !selectedCategory ? 'bg-primary-600' : 'bg-surface'
                  }`}
                >
                  <Text className={!selectedCategory ? 'text-white text-xs font-medium' : 'text-slate-400 text-xs'}>
                    All
                  </Text>
                </Pressable>
              );
            }
            return (
              <CategoryChip
                categoryId={item as TransactionCategory}
                selected={selectedCategory === item}
                onPress={() => setSelectedCategory(selectedCategory === item ? null : item)}
                showIcon={false}
              />
            );
          }}
        />
      </View>

      {isLoading ? (
        <View className="px-4 mt-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} className="flex-row items-center">
              <Skeleton width={40} height={40} radius={12} />
              <View className="flex-1 ml-3">
                <Skeleton width="60%" height={16} />
                <Skeleton width="30%" height={12} style={{ marginTop: 6 }} />
              </View>
              <Skeleton width={60} height={16} />
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorBox onRetry={refetch} />
      ) : allTransactions.length === 0 ? (
        <EmptyState
          icon="receipt-long"
          title="No transactions yet"
          description="Connect a bank account to see your transactions here."
          actionLabel="Connect Bank"
          onAction={() => router.push('/(tabs)/settings')}
        />
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => (item.type === 'header' ? `h-${item.title}` : `t-${item.data.id}`)}
          contentContainerClassName="px-4 pb-4"
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#3b82f6" />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text className="text-slate-500 text-xs font-medium uppercase mt-4 mb-1">
                  {item.title}
                </Text>
              );
            }
            return (
              <TransactionRow
                transaction={item.data}
                onPress={(id) => router.push(`/transaction/${id}`)}
              />
            );
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <Text className="text-slate-500 text-sm">Loading more...</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
