import '../../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0F172A' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen
            name="analytics"
            options={{
              headerShown: true,
              headerTitle: 'Analytics',
              headerStyle: { backgroundColor: '#0F172A' },
              headerTintColor: '#f8fafc',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="account/[id]"
            options={{
              headerShown: true,
              headerTitle: 'Account',
              headerStyle: { backgroundColor: '#0F172A' },
              headerTintColor: '#f8fafc',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="transaction/[id]"
            options={{
              headerShown: true,
              headerTitle: 'Transaction',
              headerStyle: { backgroundColor: '#0F172A' },
              headerTintColor: '#f8fafc',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="budget/create"
            options={{
              headerShown: true,
              headerTitle: 'New Budget',
              headerStyle: { backgroundColor: '#0F172A' },
              headerTintColor: '#f8fafc',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="budget/[id]"
            options={{
              headerShown: true,
              headerTitle: 'Budget',
              headerStyle: { backgroundColor: '#0F172A' },
              headerTintColor: '#f8fafc',
              presentation: 'card',
            }}
          />
        </Stack>
      </AuthProvider>
    </QueryProvider>
  );
}
