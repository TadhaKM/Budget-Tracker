import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <View className={`bg-surface rounded-2xl p-4 ${className}`} {...props}>
      {children}
    </View>
  );
}
