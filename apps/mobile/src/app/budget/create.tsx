import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { CategoryChip } from '@/components/finance/CategoryChip';
import { EXPENSE_CATEGORIES, type TransactionCategory } from '@clearmoney/shared';
import { budgetsApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function CreateBudgetScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!selectedCategory || !amount) {
      Alert.alert('Missing fields', 'Please select a category and enter a limit.');
      return;
    }

    const limitAmount = parseFloat(amount);
    if (isNaN(limitAmount) || limitAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      await budgetsApi.create({ categoryId: selectedCategory, limitAmount, period });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not create budget. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-4">
        <Text className="text-2xl font-bold text-white">New Budget</Text>
        <Text className="text-slate-400 mt-1">Set a spending limit for a category</Text>

        {/* Category selection */}
        <Card className="mt-6">
          <Text className="text-white font-semibold mb-3">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat.key}
                categoryId={cat.key}
                selected={selectedCategory === cat.key}
                onPress={() => setSelectedCategory(cat.key)}
              />
            ))}
          </View>
        </Card>

        {/* Amount */}
        <Card className="mt-4">
          <Text className="text-white font-semibold mb-3">Monthly Limit</Text>
          <View className="flex-row items-center bg-surface-light rounded-xl px-4">
            <Text className="text-white text-xl font-bold mr-1">€</Text>
            <TextInput
              className="flex-1 text-white text-xl py-4"
              placeholder="0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </Card>

        {/* Period toggle */}
        <Card className="mt-4">
          <Text className="text-white font-semibold mb-3">Period</Text>
          <View className="flex-row gap-2">
            {(['MONTHLY', 'WEEKLY'] as const).map((p) => (
              <Pressable
                key={p}
                className={`flex-1 rounded-xl py-3 items-center ${
                  period === p ? 'bg-primary-600' : 'bg-surface-light'
                }`}
                onPress={() => setPeriod(p)}
              >
                <Text className={period === p ? 'text-white font-medium' : 'text-slate-400'}>
                  {p === 'MONTHLY' ? 'Monthly' : 'Weekly'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Create button */}
        <Pressable
          className="bg-primary-600 rounded-xl p-4 mt-6 items-center active:opacity-80"
          onPress={handleCreate}
          disabled={saving}
        >
          <Text className="text-white font-semibold text-base">
            {saving ? 'Creating...' : 'Create Budget'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
