import React from 'react';
import { View, Text } from 'react-native';
import { IconSparkles } from '@tabler/icons-react-native';
import { colors } from '@/theme/tokens';
import { listeningCopy } from '@/lib/insight';
import type { Insight } from '@/types';

interface InsightCardProps {
  insight: Insight;
}

// Splits renderedText around the emphasis fragment so it can be bolded inline.
function renderPatternBody(renderedText: string, emphasis?: string) {
  if (!emphasis || !renderedText.includes(emphasis)) {
    return <Text className="text-body text-ink leading-relaxed">{renderedText}</Text>;
  }

  const [before, after] = renderedText.split(emphasis);

  return (
    <Text className="text-body text-ink leading-relaxed">
      {before}
      <Text className="font-medium">{emphasis}</Text>
      {after}
    </Text>
  );
}

export function InsightCard({ insight }: InsightCardProps) {
  const isListening = insight.kind === 'listening';

  return (
    <View className="bg-moss-bg rounded-xl px-4 py-3.5">
      <View className="flex-row items-center gap-1 mb-1.5">
        <IconSparkles size={12} color={colors.moss} strokeWidth={1.5} />
        <Text className="text-eyebrow text-moss uppercase">
          {isListening ? 'STILL LISTENING' : 'PATTERN NOTICED'}
        </Text>
      </View>

      {isListening ? (
        <Text className="text-body text-ink-2 font-serif italic">
          {listeningCopy(insight.daysOfData, insight.minDaysForPattern)}
        </Text>
      ) : (
        renderPatternBody(insight.renderedText, insight.emphasis)
      )}
    </View>
  );
}
