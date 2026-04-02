import { Pressable, Text, type PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary';
}

export function Button({ title, variant = 'primary', ...props }: ButtonProps) {
  const bg = variant === 'primary' ? 'bg-primary-600' : 'bg-surface-light';

  return (
    <Pressable className={`${bg} rounded-xl p-4 items-center active:opacity-80`} {...props}>
      <Text className="text-white font-semibold">{title}</Text>
    </Pressable>
  );
}
