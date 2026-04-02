import { View, Text, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { session } = useAuth();

  return (
    <ScreenContainer>
      <Text className="text-2xl font-bold text-white">Settings</Text>
      <Text className="text-slate-400 mt-1">{session?.user?.email}</Text>

      {/* Connected accounts */}
      <Card className="mt-6">
        <Text className="text-white font-semibold mb-3">Connected Accounts</Text>
        <Pressable className="bg-surface-light rounded-xl p-4 items-center active:opacity-80">
          <Text className="text-primary-500 font-semibold">+ Connect a Bank</Text>
        </Pressable>
      </Card>

      {/* Preferences */}
      <Card className="mt-4">
        <Text className="text-white font-semibold mb-3">Preferences</Text>
        <View className="flex-row justify-between py-2">
          <Text className="text-slate-300">Push Notifications</Text>
          <Text className="text-slate-500">Coming soon</Text>
        </View>
        <View className="flex-row justify-between py-2">
          <Text className="text-slate-300">Export Data (CSV)</Text>
          <Text className="text-slate-500">Coming soon</Text>
        </View>
      </Card>

      {/* Sign out */}
      <Pressable
        className="bg-red-900/30 rounded-xl p-4 mt-6 items-center active:opacity-80"
        onPress={() => supabase.auth.signOut()}
      >
        <Text className="text-red-400 font-semibold">Sign Out</Text>
      </Pressable>
    </ScreenContainer>
  );
}
