import { IconArrowLeft, IconShare, IconUserCircle } from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';

import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors } from '@/theme/tokens';

// Universal-link domain. Resolves to a server endpoint that will route
// friends straight to the join screen once they install the app. The
// token-only path works today even without that endpoint live — paste-the-
// link still lands on /circle/join via the join screen's extractToken().
const INVITE_BASE_URL = 'https://cadence.gilla.fun/circle/join';

export default function CircleDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const circleId = String(params.id ?? '');

  const detailQuery = useQuery({
    queryKey: queryKeys.circle(circleId),
    queryFn: () => endpoints.getCircle(apiClient)(circleId),
    enabled: circleId.length > 0,
  });

  function handleShare() {
    const circle = detailQuery.data?.circle;
    if (!circle) return;
    const url = `${INVITE_BASE_URL}/${circle.inviteToken}`;
    Share.share({
      message: `Join my Cadence circle — "${circle.name}". ${url}`,
      url,
    }).catch(() => {});
  }

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="self-start py-2 -ml-2 px-2 mb-2"
        hitSlop={8}
      >
        <IconArrowLeft size={22} color={colors.ink} strokeWidth={1.5} />
      </Pressable>

      {detailQuery.isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : !detailQuery.data ? (
        <Text className="text-body text-ink-2 mt-4">
          This circle isn't available. The link may have expired.
        </Text>
      ) : (
        <>
          <Text className="text-h1 font-serif text-ink">{detailQuery.data.circle.name}</Text>
          {detailQuery.data.circle.description ? (
            <Text className="text-body text-ink-2 mt-2">
              {detailQuery.data.circle.description}
            </Text>
          ) : null}

          <SectionLabel label={`MEMBERS · ${detailQuery.data.members.length}`} />
          <View className="gap-2">
            {detailQuery.data.members.map((member) => (
              <View
                key={member.userId}
                className="flex-row items-center gap-3 bg-card border border-hairline rounded-xl p-3"
              >
                <IconUserCircle size={20} color={colors.moss} strokeWidth={1.5} />
                <View className="flex-1">
                  <Text className="text-body text-ink font-medium">{member.displayName}</Text>
                  {member.role === 'creator' ? (
                    <Text className="text-caption text-ink-3 mt-0.5">started this circle</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <SectionLabel label="INVITE" />
          <Card padding="md">
            <Text className="text-body text-ink-2">
              Share this with friends. They tap, install Cadence, and join automatically.
            </Text>
            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share invite"
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
              className="mt-3 flex-row items-center gap-2"
            >
              <IconShare size={16} color={colors.moss} strokeWidth={1.5} />
              <Text className="text-body text-moss font-medium">Share invite</Text>
            </Pressable>
            <Text className="text-caption text-ink-3 mt-3 font-mono">
              {detailQuery.data.circle.inviteToken}
            </Text>
          </Card>

          <SectionLabel label="WHAT'S COMING" />
          <Card padding="md">
            <Text className="text-body text-ink-2 font-serif italic">
              Pacts and the activity feed land soon. Until then this is your invite hub.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
