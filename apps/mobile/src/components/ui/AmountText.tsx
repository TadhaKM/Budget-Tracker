import { Text, type TextProps } from 'react-native';
import { formatCurrency } from '@/lib/format';

interface AmountTextProps extends TextProps {
  amount: number;
  /** Show +/- sign. Default false. */
  showSign?: boolean;
  /** Override text colour based on sign. Default true. */
  colorCode?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export function AmountText({
  amount,
  showSign = false,
  colorCode = true,
  size = 'md',
  className = '',
  ...props
}: AmountTextProps) {
  let colorClass = 'text-white';
  if (colorCode) {
    if (amount > 0) colorClass = 'text-green-400';
    else if (amount < 0) colorClass = 'text-white';
  }

  return (
    <Text className={`font-bold ${sizeClasses[size]} ${colorClass} ${className}`} {...props}>
      {formatCurrency(amount, showSign)}
    </Text>
  );
}
