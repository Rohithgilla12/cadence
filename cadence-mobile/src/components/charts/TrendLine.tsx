import { useMemo, useState } from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

interface TrendLineProps {
  // Points oldest-to-newest. Use 0 for empty buckets.
  values: ReadonlyArray<number>;
  height?: number;
  // Optional caption labels under the line (e.g. ["4w ago", "this wk"]).
  // Only the first and last are rendered to keep the chart quiet.
  endLabels?: [string, string];
}

// Sparse line chart. Polyline with two endpoint dots, hairline baseline.
// Sized to fit container width using onLayout. No gridlines, no axis labels.
export function TrendLine({ values, height = 56, endLabels }: TrendLineProps) {
  const [width, setWidth] = useState(0);
  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const { path, lastPoint, firstPoint } = useMemo(() => {
    if (values.length < 2 || width === 0) {
      return { path: '', lastPoint: null, firstPoint: null };
    }
    const max = Math.max(1, ...values);
    const padding = 6;
    const usableHeight = height - 2 * padding;
    const usableWidth = width - 2 * padding;
    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * usableWidth;
      const y = padding + usableHeight - (value / max) * usableHeight;
      return { x, y };
    });
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
    return {
      path: d,
      firstPoint: points[0],
      lastPoint: points[points.length - 1],
    };
  }, [values, width, height]);

  return (
    <View>
      <View onLayout={handleLayout} style={{ height }}>
        {width > 0 && path ? (
          <Svg width={width} height={height}>
            <Path d={path} stroke={colors.moss} strokeWidth={1.5} fill="none" />
            {firstPoint ? (
              <Circle cx={firstPoint.x} cy={firstPoint.y} r={2.5} fill={colors.mossLighter} />
            ) : null}
            {lastPoint ? (
              <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill={colors.moss} />
            ) : null}
          </Svg>
        ) : null}
      </View>
      {endLabels ? (
        <View className="flex-row justify-between mt-1">
          <Text className="text-micro text-ink-3">{endLabels[0]}</Text>
          <Text className="text-micro text-ink-3">{endLabels[1]}</Text>
        </View>
      ) : null}
    </View>
  );
}
