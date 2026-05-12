import { IconCheck } from '@tabler/icons-react-native';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

interface OptionTileProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
}

export function OptionTile({ label, description, selected, onPress, trailing }: OptionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.mossBg : colors.card,
        borderColor: selected ? colors.mossLight : colors.hairline,
        borderWidth: 0.5,
        borderRadius: 14,
        padding: 16,
        opacity: pressed && !selected ? 0.9 : 1,
      })}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className={`text-body font-medium ${selected ? 'text-moss' : 'text-ink'}`}>
            {label}
          </Text>
          {description ? (
            <Text className="text-caption text-ink-2 mt-1">{description}</Text>
          ) : null}
        </View>
        {trailing ?? (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: selected ? colors.moss : 'transparent',
              borderWidth: selected ? 0 : 0.5,
              borderColor: colors.hairline2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected ? <IconCheck size={14} color="#FFFFFF" strokeWidth={2} /> : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
