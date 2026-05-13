import { View, Text } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

interface WeekBarsProps {
  // Seven values, Monday-first. Use 0 for days with no activity.
  values: ReadonlyArray<number>;
  height?: number;
  // Highlights the day at this index with moss-light vs moss. Use the current
  // weekday (0=Mon..6=Sun) to mark "today".
  todayIndex?: number;
}

// Quiet 7-day bar strip. Hairline baseline, moss-light fills, today gets
// the deeper moss. Days with zero values still render a 1px stub so the row
// reads as "seven slots", not "this is a sparse chart with gaps."
export function WeekBars({ values, height = 64, todayIndex }: WeekBarsProps) {
  const max = Math.max(1, ...values);
  const barCount = values.length;
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const barAreaHeight = height - 14; // reserve room for label row underneath
  const minBar = 2;

  return (
    <View>
      <Svg height={barAreaHeight} width="100%">
        {values.map((value, index) => {
          const fraction = max > 0 ? value / max : 0;
          const barHeight = value === 0 ? minBar : Math.max(minBar, Math.round(fraction * (barAreaHeight - 4)));
          const xPercent = (index + 0.5) / barCount;
          const isToday = todayIndex === index;
          const fill = isToday ? colors.moss : value === 0 ? colors.hairline2 : colors.mossLight;
          return (
            <Rect
              key={index}
              x={`${xPercent * 100}%`}
              y={barAreaHeight - barHeight}
              width={18}
              height={barHeight}
              rx={2}
              fill={fill}
              translateX={-9}
            />
          );
        })}
      </Svg>
      <View className="flex-row mt-2">
        {labels.slice(0, barCount).map((label, index) => (
          <View key={index} className="flex-1 items-center">
            <Text
              className={`text-micro ${
                todayIndex === index ? 'text-moss font-medium' : 'text-ink-3'
              }`}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
