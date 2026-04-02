import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScreenContainer>
      <Text className="text-2xl font-bold text-white">Transaction</Text>

      <Card className="mt-6 p-6">
        <Text className="text-slate-400 text-sm">Transaction ID</Text>
        <Text className="text-white mt-1">{id}</Text>
      </Card>

      {/* TODO: Show merchant, amount, category (editable), date, account */}
    </ScreenContainer>
  );
}
