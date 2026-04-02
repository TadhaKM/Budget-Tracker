import { View, Text, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

export default function TransactionsScreen() {
  return (
    <ScreenContainer>
      <Text className="text-2xl font-bold text-white">Transactions</Text>
      <Text className="text-slate-400 mt-1">All your accounts, one list</Text>

      {/* Filter bar placeholder */}
      <View className="flex-row gap-2 mt-4">
        <View className="bg-primary-600 rounded-full px-4 py-2">
          <Text className="text-white text-sm">All</Text>
        </View>
        <View className="bg-surface rounded-full px-4 py-2">
          <Text className="text-slate-400 text-sm">Groceries</Text>
        </View>
        <View className="bg-surface rounded-full px-4 py-2">
          <Text className="text-slate-400 text-sm">Dining</Text>
        </View>
      </View>

      {/* Empty state */}
      <View className="flex-1 items-center justify-center mt-12">
        <Text className="text-slate-400 text-lg">No transactions yet</Text>
        <Text className="text-slate-500 mt-1">Connect a bank account to get started</Text>
      </View>
    </ScreenContainer>
  );
}
