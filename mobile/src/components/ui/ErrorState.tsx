import { Text, View } from 'react-native';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

/** Error message with an optional Retry button. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <View className="gap-3" accessibilityRole="alert">
      <Text className="text-base font-semibold text-danger">{title}</Text>
      <Text className="text-base text-muted">{message}</Text>
      {onRetry ? (
        <Button
          label="Retry"
          variant="secondary"
          onPress={onRetry}
          loading={retrying}
          accessibilityHint="Tries the request again"
        />
      ) : null}
    </View>
  );
}
