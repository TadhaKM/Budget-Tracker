import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const steps = [
  {
    icon: 'account-balance' as const,
    title: 'Connect your bank',
    description: 'Link your Irish bank accounts securely through open banking. We never see your login details.',
  },
  {
    icon: 'insights' as const,
    title: 'See where your money goes',
    description: 'Transactions are automatically categorised. Track spending by week, month, or category.',
  },
  {
    icon: 'notifications-active' as const,
    title: 'Stay in control',
    description: 'Set budgets, spot subscriptions, and get plain-English insights about your money.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background px-6 pt-16 pb-8">
      {/* Logo area */}
      <View className="items-center mb-12">
        <View className="bg-primary-500/20 rounded-full p-4 mb-4">
          <MaterialIcons name="account-balance-wallet" size={40} color="#3b82f6" />
        </View>
        <Text className="text-3xl font-bold text-white">ClearMoney</Text>
        <Text className="text-slate-400 mt-2 text-center">
          Your money, made simple
        </Text>
      </View>

      {/* Feature steps */}
      <View className="flex-1 justify-center">
        {steps.map((step, i) => (
          <View key={i} className="flex-row mb-8">
            <View className="bg-surface rounded-xl w-12 h-12 items-center justify-center mr-4">
              <MaterialIcons name={step.icon} size={24} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base">{step.title}</Text>
              <Text className="text-slate-400 text-sm mt-1 leading-5">{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View className="gap-3">
        <Pressable
          className="bg-primary-600 rounded-xl p-4 items-center active:opacity-80"
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text className="text-white font-semibold text-base">Get Started</Text>
        </Pressable>

        <Pressable
          className="rounded-xl p-4 items-center active:opacity-80"
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text className="text-slate-400 font-medium text-sm">
            Already have an account? Sign in
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
