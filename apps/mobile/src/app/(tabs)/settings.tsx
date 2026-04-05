import { View, Text, Pressable, Alert, Linking } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { ListItem } from '@/components/ui/ListItem';
import { Divider } from '@/components/ui/Divider';
import { Skeleton } from '@/components/ui/Skeleton';
import { AccountCard, type AccountData } from '@/components/finance/AccountCard';
import { useAuth } from '@/providers/AuthProvider';
import { useAccounts } from '@/hooks/useAccounts';
import { useConnections, useConnectBank, useInstitutions } from '@/hooks/useConnections';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: institutions } = useInstitutions();
  const connectBank = useConnectBank();

  async function handleConnectBank() {
    if (!institutions || institutions.length === 0) {
      Alert.alert('No institutions available', 'Please try again later.');
      return;
    }

    // For now, show a simple picker for available institutions
    // In production this would be a proper selection screen
    const inst = institutions[0] as { id: string; name: string };
    try {
      const res = await connectBank.mutateAsync(inst.id);
      const authUrl = res.data.authUrl;
      await Linking.openURL(authUrl);
    } catch {
      Alert.alert('Connection failed', 'Could not connect to your bank. Please try again.');
    }
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <ScreenContainer>
      <Text className="text-2xl font-bold text-white">Settings</Text>
      <Text className="text-slate-400 mt-1">{session?.user?.email}</Text>

      {/* Connected accounts */}
      <View className="mt-6">
        <Text className="text-white font-semibold text-lg mb-3">Connected Accounts</Text>

        {accountsLoading ? (
          <View className="gap-3">
            <Skeleton height={64} radius={16} />
            <Skeleton height={64} radius={16} />
          </View>
        ) : accounts && accounts.length > 0 ? (
          <>
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onPress={(id) => router.push(`/account/${id}`)}
              />
            ))}
          </>
        ) : null}

        <Pressable
          className="bg-surface rounded-2xl p-4 items-center active:opacity-80 mt-2"
          onPress={handleConnectBank}
        >
          <Text className="text-primary-500 font-semibold">+ Connect a Bank</Text>
        </Pressable>
      </View>

      {/* Preferences */}
      <Card className="mt-6">
        <Text className="text-white font-semibold mb-1">Preferences</Text>
        <ListItem
          icon="notifications"
          title="Notifications"
          subtitle="Manage alerts and digests"
          onPress={() => {}}
          showChevron
        />
        <Divider />
        <ListItem
          icon="download"
          title="Export Data"
          subtitle="Download transactions as CSV"
          onPress={() => {}}
          showChevron
        />
        <Divider />
        <ListItem
          icon="security"
          title="Privacy & Security"
          subtitle="Manage your data"
          onPress={() => {}}
          showChevron
        />
      </Card>

      {/* About */}
      <Card className="mt-4">
        <Text className="text-white font-semibold mb-1">About</Text>
        <ListItem title="App Version" subtitle="1.0.0" showChevron={false} />
        <Divider />
        <ListItem
          icon="help"
          title="Help & Support"
          onPress={() => {}}
          showChevron
        />
      </Card>

      {/* Sign out */}
      <Pressable
        className="bg-red-900/30 rounded-2xl p-4 mt-6 items-center active:opacity-80"
        onPress={handleSignOut}
      >
        <Text className="text-red-400 font-semibold">Sign Out</Text>
      </Pressable>

      <View className="h-8" />
    </ScreenContainer>
  );
}
