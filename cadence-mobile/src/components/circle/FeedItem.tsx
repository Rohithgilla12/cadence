import { IconCheck, IconFlower, IconUserCircle } from '@tabler/icons-react-native';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/primitives';
import { colors } from '@/theme/tokens';
import type { ApiFeedItem } from '@/lib/api/types';

interface FeedItemProps {
  item: ApiFeedItem;
  onToggleReaction: () => void;
  busy: boolean;
}

function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 60_000) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function describe(item: ApiFeedItem): { title: string; subtitle?: string } {
  if (item.kind === 'habit_done') {
    const habitName = typeof item.payload?.habitName === 'string' ? item.payload.habitName : null;
    const source = typeof item.payload?.source === 'string' ? item.payload.source : null;
    const fromHealth = source && source !== 'manual';
    return {
      title: habitName ? `${item.displayName} did ${habitName}` : `${item.displayName} checked in`,
      subtitle: fromHealth ? 'auto-detected from Apple Health' : undefined,
    };
  }
  if (item.kind === 'pact_complete') {
    return { title: `${item.displayName} closed a pact` };
  }
  if (item.kind === 'back_after_quiet') {
    return { title: `${item.displayName} is back` };
  }
  return { title: `${item.displayName}` };
}

// Single feed row. Anti-performance per PRD §10 — no fire emojis, no
// streak counts, no rank. One reaction (flower) with a count, that's it.
export function FeedItem({ item, onToggleReaction, busy }: FeedItemProps) {
  const { title, subtitle } = describe(item);

  return (
    <Card padding="md">
      <View className="flex-row items-start gap-3">
        <IconUserCircle size={20} color={colors.moss} strokeWidth={1.5} />
        <View className="flex-1">
          <Text className="text-body text-ink">{title}</Text>
          {subtitle ? (
            <Text className="text-caption text-ink-3 mt-0.5">{subtitle}</Text>
          ) : null}
          {item.note ? (
            <Text className="text-body-sm text-ink-2 mt-2 font-serif italic">
              {item.note}
            </Text>
          ) : null}
          <View className="flex-row items-center mt-3 gap-3">
            <Text className="text-caption text-ink-3">{formatRelative(item.createdAt)}</Text>
            {item.kind === 'habit_done' ? (
              <IconCheck size={12} color={colors.mossLight} strokeWidth={1.5} />
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={onToggleReaction}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={
            item.viewerReacted ? 'Remove flower' : 'Send a flower'
          }
          accessibilityState={{ selected: item.viewerReacted }}
          hitSlop={8}
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
          className="flex-row items-center gap-1 py-1 px-2 -mr-2"
        >
          <IconFlower
            size={18}
            color={item.viewerReacted ? colors.moss : colors.ink3}
            strokeWidth={1.5}
          />
          {item.reactionCount > 0 ? (
            <Text
              className={`text-caption ${
                item.viewerReacted ? 'text-moss font-medium' : 'text-ink-3'
              }`}
            >
              {item.reactionCount}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </Card>
  );
}
