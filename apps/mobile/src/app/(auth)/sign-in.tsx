import { View, Text, Pressable, TextInput } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <View className="flex-1 bg-background justify-center p-6">
      <Text className="text-3xl font-bold text-white text-center">ClearMoney</Text>
      <Text className="text-slate-400 text-center mt-2">
        See all your money in one place
      </Text>

      {sent ? (
        <View className="mt-8">
          <Text className="text-white text-center text-lg">Check your email</Text>
          <Text className="text-slate-400 text-center mt-2">
            We sent a magic link to {email}
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            className="bg-surface text-white rounded-xl p-4 mt-8"
            placeholder="you@example.com"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Pressable
            className="bg-primary-600 rounded-xl p-4 mt-4 items-center active:opacity-80"
            onPress={handleSignIn}
            disabled={loading || !email}
          >
            <Text className="text-white font-semibold">
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
