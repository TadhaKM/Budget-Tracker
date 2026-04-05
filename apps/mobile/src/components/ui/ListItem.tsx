import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface ListItemProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  rightText?: string;
  rightSubtext?: string;
  onPress?: () => void;
  showChevron?: boolean;
}

export function ListItem({
  icon,
  iconColor = '#94a3b8',
  title,
  subtitle,
  rightText,
  rightSubtext,
  onPress,
  showChevron = true,
}: ListItemProps) {
  return (
    <Pressable
      className="flex-row items-center py-3 active:opacity-70"
      onPress={onPress}
      disabled={!onPress}
    >
      {icon && (
        <View className="bg-surface-light rounded-xl w-10 h-10 items-center justify-center mr-3">
          <MaterialIcons name={icon} size={20} color={iconColor} />
        </View>
      )}

      <View className="flex-1 mr-2">
        <Text className="text-white text-base" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-slate-500 text-sm mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {(rightText || rightSubtext) && (
        <View className="items-end mr-1">
          {rightText && <Text className="text-white text-base font-medium">{rightText}</Text>}
          {rightSubtext && <Text className="text-slate-500 text-xs mt-0.5">{rightSubtext}</Text>}
        </View>
      )}

      {onPress && showChevron && <MaterialIcons name="chevron-right" size={20} color="#475569" />}
    </Pressable>
  );
}
