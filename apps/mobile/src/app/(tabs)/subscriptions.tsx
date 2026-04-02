import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';

export default function SubscriptionsScreen() {
  return (
    <ScreenContainer>
      <Text className="text-2xl font-bold text-white">Subscriptions</Text>
      <Text className="text-slate-400 mt-1">Your recurring payments</Text>

      {/* Monthly total */}
      <Card className="mt-6 p-6">
        <Text className="text-slate-400 text-sm">Monthly Total</Text>
        <Text className="text-white text-3xl font-bold mt-1">€0.00</Text>
        <Text className="text-slate-500 text-sm mt-1">per month in recurring charges</Text>
      </Card>

      {/* Empty state */}
      <Card className="mt-4 items-center py-8">
        <Text className="text-slate-400 text-lg">No subscriptions detected</Text>
        <Text className="text-slate-500 mt-1 text-center px-4">
          We'll automatically find recurring payments once you connect a bank
        </Text>
      </Card>
    </ScreenContainer>
  );
}
