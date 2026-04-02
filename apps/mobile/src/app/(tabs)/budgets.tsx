import { View, Text, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';

export default function BudgetsScreen() {
  return (
    <ScreenContainer>
      <View className="flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-white">Budgets</Text>
        <Pressable className="bg-primary-600 rounded-full px-4 py-2 active:opacity-80">
          <Text className="text-white text-sm font-semibold">+ Add Budget</Text>
        </Pressable>
      </View>
      <Text className="text-slate-400 mt-1">Set limits, stay in control</Text>

      {/* Empty state */}
      <Card className="mt-6 items-center py-8">
        <Text className="text-slate-400 text-lg">No budgets set</Text>
        <Text className="text-slate-500 mt-1 text-center px-4">
          Tap "Add Budget" to set a spending limit for a category
        </Text>
      </Card>
    </ScreenContainer>
  );
}
