import { View } from 'react-native';

import { colors } from '@/theme/tokens';

interface StepProgressDotsProps {
  current: number;   // 1-indexed
  total: number;
}

export function StepProgressDots({ current, total }: StepProgressDotsProps) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => {
        const filled = step <= current;
        return (
          <View
            key={step}
            style={{
              width: filled ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: filled ? colors.moss : colors.hairline2,
            }}
          />
        );
      })}
    </View>
  );
}
