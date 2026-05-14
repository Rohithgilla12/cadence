import { IconUsersGroup } from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';

import { Pill } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors } from '@/theme/tokens';

interface SharedWithPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

// Multi-select chips for the user's circles. Per PRD §10 sharing is
// per-habit and opt-in — the picker doesn't default to anything, and an
// empty selection means the habit stays private to the user.
export function SharedWithPicker({ value, onChange }: SharedWithPickerProps) {
  const circlesQuery = useQuery({
    queryKey: queryKeys.circles,
    queryFn: endpoints.listCircles(apiClient),
  });

  if (circlesQuery.isLoading) {
    return (
      <View className="py-2">
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }

  const circles = circlesQuery.data ?? [];
  if (circles.length === 0) {
    return (
      <Text className="text-caption text-ink-3">
        Join or start a circle first to share this habit.
      </Text>
    );
  }

  const selected = new Set(value);

  function toggle(circleId: string) {
    if (selected.has(circleId)) {
      onChange(value.filter((id) => id !== circleId));
    } else {
      onChange([...value, circleId]);
    }
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {circles.map((circle) => {
        const isSelected = selected.has(circle.id);
        return (
          <Pill
            key={circle.id}
            label={circle.name}
            selected={isSelected}
            icon={
              <IconUsersGroup
                size={11}
                color={isSelected ? colors.moss : colors.ink2}
                strokeWidth={1.5}
              />
            }
            onPress={() => toggle(circle.id)}
          />
        );
      })}
    </View>
  );
}
