import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card } from '@/components/ui/Card';

export interface InsightData {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead?: boolean;
}

interface InsightCardProps {
  insight: InsightData;
  onPress?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const typeConfig: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  SPENDING_UP: { icon: 'trending-up', color: '#ef4444' },
  SPENDING_DOWN: { icon: 'trending-down', color: '#22c55e' },
  BIG_CATEGORY: { icon: 'pie-chart', color: '#f97316' },
  LOW_INCOME_WEEK: { icon: 'warning', color: '#f59e0b' },
  ZERO_SPEND_WEEK: { icon: 'celebration', color: '#22c55e' },
  BUDGET_WARNING: { icon: 'warning', color: '#f59e0b' },
  BUDGET_EXCEEDED: { icon: 'error', color: '#ef4444' },
  UNUSUAL_SPEND: { icon: 'info', color: '#3b82f6' },
  NEW_SUBSCRIPTION: { icon: 'autorenew', color: '#8b5cf6' },
};

export function InsightCard({ insight, onPress, onDismiss }: InsightCardProps) {
  const config = typeConfig[insight.type] ?? { icon: 'lightbulb' as const, color: '#3b82f6' };

  return (
    <Pressable onPress={() => onPress?.(insight.id)} disabled={!onPress}>
      <Card className="mb-3">
        <View className="flex-row items-start">
          <View
            className="w-8 h-8 rounded-lg items-center justify-center mr-3 mt-0.5"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <MaterialIcons name={config.icon} size={18} color={config.color} />
          </View>

          <View className="flex-1">
            <Text className="text-white font-medium">{insight.title}</Text>
            <Text className="text-slate-400 text-sm mt-1">{insight.body}</Text>
          </View>

          {onDismiss && (
            <Pressable onPress={() => onDismiss(insight.id)} hitSlop={8} className="ml-2">
              <MaterialIcons name="close" size={18} color="#64748b" />
            </Pressable>
          )}
        </View>
      </Card>
    </Pressable>
  );
}
