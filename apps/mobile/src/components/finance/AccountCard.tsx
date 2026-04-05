import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/format';

export interface AccountData {
  id: string;
  bankName: string;
  accountName: string;
  accountType: string;
  balance: number;
  currency: string;
  lastSyncedAt?: string | null;
}

interface AccountCardProps {
  account: AccountData;
  onPress?: (id: string) => void;
}

const typeIcons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  CURRENT: 'account-balance',
  SAVINGS: 'savings',
  CREDIT_CARD: 'credit-card',
};

export function AccountCard({ account, onPress }: AccountCardProps) {
  const { id, bankName, accountName, accountType, balance, currency } = account;
  const icon = typeIcons[accountType] ?? 'account-balance';

  return (
    <Pressable onPress={() => onPress?.(id)} disabled={!onPress}>
      <Card className="mb-3">
        <View className="flex-row items-center">
          <View className="bg-primary-500/20 w-10 h-10 rounded-xl items-center justify-center mr-3">
            <MaterialIcons name={icon} size={20} color="#3b82f6" />
          </View>

          <View className="flex-1">
            <Text className="text-white font-medium">{accountName}</Text>
            <Text className="text-slate-500 text-xs mt-0.5">{bankName} · {accountType}</Text>
          </View>

          <View className="items-end">
            <Text className="text-white font-semibold text-base">
              {formatCurrency(balance)}
            </Text>
            <Text className="text-slate-500 text-xs mt-0.5">{currency}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
