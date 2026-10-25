import { View } from 'react-native';

export interface SkeletonProps {
  /** Tailwind size classes, e.g. "h-4 w-32". */
  className?: string;
}

/** Placeholder block shown while content loads. Static (no animation), so no motion concerns. */
export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return <View className={`rounded-control bg-line ${className}`} />;
}
