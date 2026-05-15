import React from 'react';
import { ScrollView, View, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { screenPaddingX } from '@/theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

// Top padding = safe area top inset + 20px breathing room per DS §4.
// Horizontal padding uses the deliberate 22px value from tokens.
export function Screen({ children, scroll = true, className = '', onRefresh, refreshing }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + 20;

  const sharedStyle = {
    paddingTop: topPadding,
    paddingHorizontal: screenPaddingX,
  };

  if (scroll) {
    return (
      <View className={`flex-1 bg-bg ${className}`}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ ...sharedStyle, paddingBottom: 96 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className={`flex-1 bg-bg ${className}`} style={sharedStyle}>
      {children}
    </View>
  );
}
