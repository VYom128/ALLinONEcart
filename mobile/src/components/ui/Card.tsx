import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

export interface CardProps extends ViewProps {
  children: ReactNode;
  className?: string;
}

/** Surface with a border and the card radius. */
export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <View className={`gap-3 rounded-card border border-line bg-surface p-4 ${className}`} {...rest}>
      {children}
    </View>
  );
}
