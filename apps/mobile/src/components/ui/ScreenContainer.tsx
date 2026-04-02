import { ScrollView, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps extends ScrollViewProps {
  children: React.ReactNode;
}

export function ScreenContainer({ children, ...props }: ScreenContainerProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="p-4" {...props}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
