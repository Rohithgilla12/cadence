import { Text, View } from 'react-native';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

interface PageChapterProps {
  current: number; // 1-indexed
  total: number;
}

// Onboarding's chapter marker. Reads like the spine of a book —
// Roman numerals separated by mid-dots, the current chapter in moss,
// the rest in a hairline ink. Replaces the old fill-the-dots indicator,
// which scanned as a progress bar and clashed with PRD §3 ("Cadence
// doesn't celebrate completion the Duolingo way").
export function PageChapter({ current, total }: PageChapterProps) {
  return (
    <View className="flex-row items-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((step, idx) => {
        const here = step === current;
        return (
          <View key={step} className="flex-row items-center gap-2">
            <Text
              className={`text-eyebrow ${here ? 'text-moss' : 'text-ink-3'}`}
              style={{ letterSpacing: 1.6 }}
            >
              {ROMAN[step - 1] ?? step}
            </Text>
            {idx < total - 1 ? (
              <Text className="text-eyebrow text-ink-3" style={{ letterSpacing: 1.6 }}>
                ·
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
