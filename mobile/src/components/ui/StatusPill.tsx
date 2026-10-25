import { Text, View } from 'react-native';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusPillProps {
  /** Always shown as text: colour is never the only signal (spec §13.3). */
  label: string;
  tone?: StatusTone;
}

const CONTAINER: Record<StatusTone, string> = {
  success: 'bg-success/15',
  warning: 'bg-warning/15',
  danger: 'bg-danger/15',
  neutral: 'bg-line',
};

const TEXT: Record<StatusTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted',
};

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-muted',
};

/** Small rounded status label with a coloured dot. */
export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${CONTAINER[tone]}`}
    >
      <View className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
      <Text className={`text-sm font-medium ${TEXT[tone]}`}>{label}</Text>
    </View>
  );
}
