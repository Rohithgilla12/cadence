import {
  IconBook2,
  IconCoffee,
  IconLeaf,
  IconMusic,
  IconPencil,
  IconRun,
  IconSparkles,
  IconWalk,
  IconYoga,
} from '@tabler/icons-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { colors } from '@/theme/tokens';

type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

interface IconChoice {
  slug: string;
  Icon: IconComponent;
  label: string;
}

// Slugs match the server's `icon` field and the iconFor map in HabitRow. Add
// here when expanding — also extend src/lib/mockData.ts iconFor and the
// server has no enum constraint so the slug is free-form.
const CHOICES: IconChoice[] = [
  { slug: 'run', Icon: IconRun, label: 'Run' },
  { slug: 'yoga', Icon: IconYoga, label: 'Yoga' },
  { slug: 'walk', Icon: IconWalk, label: 'Walk' },
  { slug: 'book-2', Icon: IconBook2, label: 'Read' },
  { slug: 'pencil', Icon: IconPencil, label: 'Write' },
  { slug: 'music', Icon: IconMusic, label: 'Practice' },
  { slug: 'coffee', Icon: IconCoffee, label: 'Drink water' },
  { slug: 'leaf', Icon: IconLeaf, label: 'Recover' },
  { slug: 'sparkles', Icon: IconSparkles, label: 'Something else' },
];

interface IconPickerProps {
  value: string;
  onChange: (slug: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingRight: 22 }}
    >
      {CHOICES.map(({ slug, Icon, label }) => {
        const selected = slug === value;
        return (
          <Pressable
            key={slug}
            onPress={() => onChange(slug)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            style={({ pressed }) => ({
              width: 56,
              height: 56,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.mossBg : colors.card,
              borderWidth: 0.5,
              borderColor: selected ? colors.mossLight : colors.hairline,
              opacity: pressed && !selected ? 0.85 : 1,
            })}
          >
            <Icon
              size={22}
              color={selected ? colors.moss : colors.ink2}
              strokeWidth={1.5}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
