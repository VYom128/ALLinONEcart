import { ActivityIndicator, Pressable, Text } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Read by screen readers; defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 active:bg-primary-700',
  secondary: 'border border-line bg-surface active:bg-canvas',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-ink',
};

/** Button with a 44 pt minimum touch target, loading and disabled states. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={4}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-control px-4 py-2.5 ${
        CONTAINER[variant]
      } ${inactive ? 'opacity-60' : ''}`}
    >
      {loading ? <ActivityIndicator size="small" className={LABEL[variant]} /> : null}
      <Text className={`text-base font-semibold ${LABEL[variant]}`}>{label}</Text>
    </Pressable>
  );
}
