import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';

export default function HomeScreen() {
  return (
    <ScreenContainer>
      <Text className="text-2xl font-bold text-white">ClearMoney</Text>
      <Text className="text-slate-400 mt-1">Your money at a glance</Text>

      {/* Total balance */}
      <Card className="mt-6 p-6">
        <Text className="text-slate-400 text-sm">Total Balance</Text>
        <Text className="text-white text-3xl font-bold mt-1">€0.00</Text>
      </Card>

      {/* Weekly summary */}
      <Card className="mt-4">
        <Text className="text-white font-semibold">This Week</Text>
        <Text className="text-slate-400 mt-1">Connect a bank to see insights</Text>
      </Card>

      {/* Spending by category */}
      <Card className="mt-4">
        <Text className="text-white font-semibold">Top Categories</Text>
        <Text className="text-slate-400 mt-1">No spending data yet</Text>
      </Card>

      {/* Recent transactions */}
      <View className="mt-6">
        <Text className="text-white font-semibold text-lg">Recent Transactions</Text>
        <Text className="text-slate-400 mt-2">No transactions yet</Text>
      </View>
    </ScreenContainer>
  );
}
