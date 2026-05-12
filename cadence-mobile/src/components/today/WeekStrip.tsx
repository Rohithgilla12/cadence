import React from 'react';
import { View, Text } from 'react-native';
import type { DayDot } from '@/types';

interface WeekStripProps {
  days: DayDot[];
}

function DayColumn({ day }: { day: DayDot }) {
  const isToday = day.state === 'today';

  const weekdayTextClass = isToday
    ? 'text-caption text-moss font-medium'
    : 'text-caption text-ink-3';

  return (
    <View style={{ width: 32 }} className="items-center gap-1.5">
      <Text className={weekdayTextClass}>{day.weekday}</Text>
      <DayDotIndicator state={day.state} />
    </View>
  );
}

function DayDotIndicator({ state }: { state: DayDot['state'] }) {
  if (state === 'past-done') {
    return <View style={{ width: 24, height: 24 }} className="rounded-full bg-moss-light" />;
  }

  if (state === 'past-quiet') {
    return (
      <View
        style={{ width: 24, height: 24 }}
        className="rounded-full bg-transparent border border-hairline-2"
      />
    );
  }

  if (state === 'today') {
    return (
      <View
        style={{ width: 24, height: 24 }}
        className="rounded-full bg-moss items-center justify-center"
      >
        {/* White inner dot marks today clearly without adding complexity. */}
        <View style={{ width: 6, height: 6 }} className="rounded-full bg-white" />
      </View>
    );
  }

  // future
  return <View style={{ width: 24, height: 24 }} className="rounded-full bg-paper-2" />;
}

export function WeekStrip({ days }: WeekStripProps) {
  return (
    <View className="flex-row justify-between gap-1">
      {days.map((day) => (
        <DayColumn key={day.date} day={day} />
      ))}
    </View>
  );
}
