import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

interface LineChoiceProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  // 'radio' for one-of-many (intent), 'check' for many-of-many
  // (pillars, practices). Affects accessibility role only — the
  // visual treatment is identical (no checkbox chrome).
  mode?: 'radio' | 'check';
}

// A single choice in an onboarding question. Reads as a journal line,
// not a form tile. Selected lines move the serif label into moss, lift
// it slightly with a moss-bg-2 paper tint, and earn a small dot in the
// gutter. Unselected lines have full hairline weight so the list
// scans as a list, not a card stack — flipping the impeccable
// no-cards-in-cards reflex by simply not wrapping in cards.
export function LineChoice({ label, description, selected, onPress, mode = 'radio' }: LineChoiceProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: selected ? colors.mossBg : 'transparent',
      })}
    >
      <View className="flex-row items-start gap-3">
        <View
          style={{
            width: 6,
            height: 6,
            marginTop: 11,
            borderRadius: 3,
            backgroundColor: selected ? colors.moss : 'transparent',
          }}
        />
        <View className="flex-1">
          <Text
            className={`font-serif text-h2 ${selected ? 'text-moss' : 'text-ink'}`}
          >
            {label}
          </Text>
          {description ? (
            <Text className="mt-1 text-body-sm text-ink-2 leading-relaxed">
              {description}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
