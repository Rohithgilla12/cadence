import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';
import type { ApiRhythmWeekday } from '@/lib/api/types';

interface RhythmBarsProps {
  byWeekday: ReadonlyArray<ApiRhythmWeekday>;
  todayIndex?: number;
  height?: number;
}

// Vertical bar strip — one column per weekday, height proportional to
// completion rate. Quiet styling per the design system: hairline baseline,
// moss-light for ordinary bars, deeper moss for today. No axis labels,
// no percentages on top — the inline weekday letters under the bars do
// double duty. PRD §3 voice: observational, not gamified.
export function RhythmBars({ byWeekday, todayIndex, height = 96 }: RhythmBarsProps) {
  const [width, setWidth] = useState(0);
  const safeHeight = Math.max(48, height);
  const barAreaHeight = safeHeight - 18; // reserve label row
  const minBar = 2;
  const barWidth = 22;
  const columns = byWeekday.length || 7;

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  // Bars are scaled against 1.0 (100% completion) so the axis is
  // semantically meaningful — comparing two weeks renders consistent
  // heights instead of normalizing the spike of the moment.
  return (
    <View>
      <View onLayout={handleLayout}>
        {width > 0 ? (
          <Svg width={width} height={barAreaHeight}>
            {byWeekday.map((bucket, index) => {
              const rate = Math.min(1, Math.max(0, bucket.completionRate));
              const barHeight =
                bucket.totalSlots === 0
                  ? minBar
                  : Math.max(minBar, Math.round(rate * (barAreaHeight - 4)));
              const centerX = ((index + 0.5) / columns) * width;
              const isToday = todayIndex === index;
              const isEmpty = bucket.totalSlots === 0;
              const fill = isToday
                ? colors.moss
                : isEmpty
                  ? colors.hairline2
                  : colors.mossLight;
              return (
                <Rect
                  key={index}
                  x={centerX - barWidth / 2}
                  y={barAreaHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  fill={fill}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View className="flex-row mt-2">
        {byWeekday.map((bucket, index) => (
          <View key={index} className="flex-1 items-center">
            <Text
              className={`text-micro ${
                todayIndex === index ? 'text-moss font-medium' : 'text-ink-3'
              }`}
            >
              {bucket.label.slice(0, 1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
