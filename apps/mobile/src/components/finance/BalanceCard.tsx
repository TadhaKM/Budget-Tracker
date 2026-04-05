import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/format';

interface BalanceCardProps {
  totalBalance: number;
  accountCount: number;
  lastSynced?: string | null;
  onPress?: () => void;
}

export function BalanceCard({ totalBalance, accountCount, lastSynced, onPress }: BalanceCardProps) {
  const syncText = lastSynced
    ? `Updated ${new Date(lastSynced).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`
    : 'Not synced yet';

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card className="p-6">
        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-slate-400 text-sm">Total Balance</Text>
            <Text className="text-white text-3xl font-bold mt-1">
              {formatCurrency(totalBalance)}
            </Text>
          </View>
          <View className="bg-primary-500/20 rounded-full p-2">
            <MaterialIcons name="account-balance-wallet" size={20} color="#3b82f6" />
          </View>
        </View>
        <View className="flex-row items-center mt-3">
          <Text className="text-slate-500 text-xs">
            {accountCount} account{accountCount !== 1 ? 's' : ''} · {syncText}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
