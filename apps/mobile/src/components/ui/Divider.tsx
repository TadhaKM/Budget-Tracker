import { View } from 'react-native';

interface DividerProps {
  className?: string;
}

export function Divider({ className = '' }: DividerProps) {
  return <View className={`h-px bg-surface-light my-3 ${className}`} />;
}
