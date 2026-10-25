import { router, Stack } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <Card>
          <Text className="text-lg font-semibold text-ink" accessibilityRole="header">
            This screen doesn&apos;t exist
          </Text>
          <Text className="text-base text-muted">The link may be old or mistyped.</Text>
          <Button label="Go to home" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    </>
  );
}
