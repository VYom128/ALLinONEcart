import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface ScreenProps {
  children: ReactNode;
  /** Scroll the content (default true). Lists use their own FlashList instead. */
  scroll?: boolean;
}

/** Page wrapper: safe area, canvas background and the 16 pt side gutter. */
export function Screen({ children, scroll = true }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 py-6"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 gap-4 px-4 py-6">{children}</View>
      )}
    </SafeAreaView>
  );
}
