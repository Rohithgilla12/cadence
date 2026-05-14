import { useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';
import type { ApiHeatmapDay } from '@/lib/api/types';

interface ConsistencyHeatmapProps {
  days: ReadonlyArray<ApiHeatmapDay>;
  // Cell color uses a monochrome moss ramp. Per the design system we do
  // not introduce new tokens for heatmap intensity — same family, same
  // tokens used elsewhere (HR zones).
}

const CELL_GAP = 4;
const MIN_CELL = 12;
const MAX_CELL = 18;
const ROW_COUNT = 7; // Mon..Sun rows; columns are weeks

// Five-step monochrome ramp: empty → paper-2; otherwise scales from
// moss-bg-2 through moss for rate=1. The DOM-level Svg renders an exact
// hex color so we don't depend on Tailwind class resolution inside react-
// native-svg fill props.
function cellColor(rate: number, hasSlots: boolean): string {
  if (!hasSlots) return colors.paper2;
  if (rate <= 0) return colors.paper2;
  if (rate < 0.34) return colors.mossBg2;
  if (rate < 0.67) return colors.mossLighter;
  if (rate < 1) return colors.mossLight;
  return colors.moss;
}

// Mon=0..Sun=6 row index — matches Cadence convention.
function rowIndexFor(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// Group days into columns of 7 (one column = one week). The first column
// may be partially filled if the window starts mid-week — leading cells
// are placeholders to keep the calendar grid aligned.
function buildColumns(
  days: ReadonlyArray<ApiHeatmapDay>,
): Array<Array<ApiHeatmapDay | null>> {
  if (days.length === 0) return [];
  const columns: Array<Array<ApiHeatmapDay | null>> = [];
  let current: Array<ApiHeatmapDay | null> = new Array(ROW_COUNT).fill(null);
  const firstDate = new Date(days[0].date);
  const startRow = rowIndexFor(firstDate);
  // Pad the leading nulls so the first day lands at its weekday row.
  for (let i = 0; i < ROW_COUNT; i++) {
    current[i] = i < startRow ? null : null;
  }
  let row = startRow;
  for (const day of days) {
    current[row] = day;
    row++;
    if (row >= ROW_COUNT) {
      columns.push(current);
      current = new Array(ROW_COUNT).fill(null);
      row = 0;
    }
  }
  // Push the trailing partial column.
  if (current.some((cell) => cell !== null)) {
    columns.push(current);
  }
  return columns;
}

export function ConsistencyHeatmap({ days }: ConsistencyHeatmapProps) {
  const [width, setWidth] = useState(0);
  const columns = useMemo(() => buildColumns(days), [days]);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  // Compute a cell size that fits all columns into the container width,
  // clamped to [MIN_CELL, MAX_CELL]. The grid stays edge-to-edge without
  // overflowing the parent.
  const cellSize = useMemo(() => {
    if (width === 0 || columns.length === 0) return MIN_CELL;
    const sized = Math.floor((width - CELL_GAP * (columns.length - 1)) / columns.length);
    return Math.max(MIN_CELL, Math.min(MAX_CELL, sized));
  }, [width, columns.length]);
  const gridWidth = columns.length * cellSize + (columns.length - 1) * CELL_GAP;
  const gridHeight = ROW_COUNT * cellSize + (ROW_COUNT - 1) * CELL_GAP;

  return (
    <View onLayout={handleLayout}>
      {width > 0 && columns.length > 0 ? (
        <Svg width={gridWidth} height={gridHeight}>
          {columns.map((column, colIdx) =>
            column.map((cell, rowIdx) => {
              const x = colIdx * (cellSize + CELL_GAP);
              const y = rowIdx * (cellSize + CELL_GAP);
              const fill = cell
                ? cellColor(cell.completionRate, cell.totalSlots > 0)
                : 'transparent';
              return (
                <Rect
                  key={`${colIdx}-${rowIdx}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={3}
                  fill={fill}
                />
              );
            }),
          )}
        </Svg>
      ) : null}
      <View className="flex-row justify-between mt-2">
        <Text className="text-micro text-ink-3">less</Text>
        <Text className="text-micro text-ink-3">more</Text>
      </View>
    </View>
  );
}
