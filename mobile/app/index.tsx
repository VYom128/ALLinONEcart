import { Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import { HealthCard } from '@/features/health/components/HealthCard';

// Temporary home for Phase 0. It becomes the dashboard (Cart card + Goals card) in Phase 4.
export default function Home() {
  return (
    <Screen>
      <View className="gap-1">
        <Text className="text-3xl font-bold text-ink" accessibilityRole="header">
          ALLinONEcart
        </Text>
        <Text className="text-base text-muted">Every cart and every goal, in one app.</Text>
      </View>
      <HealthCard />
    </Screen>
  );
}
