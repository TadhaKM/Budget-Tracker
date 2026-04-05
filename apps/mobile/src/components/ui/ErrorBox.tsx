import { View, Text } from 'react-native';
import { Button } from './Button';

interface ErrorBoxProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorBox({ message = 'Something went wrong', onRetry }: ErrorBoxProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Text className="text-red-400 text-lg font-semibold text-center">{message}</Text>
      <Text className="text-slate-500 text-sm text-center mt-2">
        Please check your connection and try again
      </Text>
      {onRetry && (
        <View className="mt-4">
          <Button title="Retry" variant="secondary" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
