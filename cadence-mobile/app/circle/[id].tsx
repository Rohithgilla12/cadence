import {
  IconArrowLeft,
  IconCheck,
  IconCirclePlus,
  IconShare,
  IconUserCircle,
} from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';

import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/client';
import { colors } from '@/theme/tokens';
import type { ApiPact, ApiPactProgress } from '@/lib/api/types';

// Universal-link domain. Resolves to a server endpoint that will route
// friends straight to the join screen once they install the app. The
// token-only path works today even without that endpoint live — paste-the-
// link still lands on /circle/join via the join screen's extractToken().
const INVITE_BASE_URL = 'https://cadence.gilla.fun/circle/join';

function isCurrent(pact: ApiPact, now: Date = new Date()): boolean {
  const end = new Date(pact.endDate);
  end.setHours(23, 59, 59, 999);
  return end.getTime() >= now.getTime();
}

function formatRange(pact: ApiPact): string {
  const start = new Date(pact.startDate);
  const end = new Date(pact.endDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function CircleDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const circleId = String(params.id ?? '');

  const detailQuery = useQuery({
    queryKey: queryKeys.circle(circleId),
    queryFn: () => endpoints.getCircle(apiClient)(circleId),
    enabled: circleId.length > 0,
  });
  const pactsQuery = useQuery({
    queryKey: queryKeys.circlePacts(circleId),
    queryFn: () => endpoints.listPacts(apiClient)(circleId),
    enabled: circleId.length > 0,
  });

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });
  const myUserId = meQuery.data?.id ?? '';

  const completeMutation = useMutation({
    mutationFn: (pactId: string) => endpoints.completePact(apiClient)(pactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.circlePacts(circleId) });
    },
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

  const pacts = pactsQuery.data ?? [];
  const currentPacts = pacts.filter((p) => isCurrent(p));
  const pastPacts = pacts.filter((p) => !isCurrent(p));

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

          <SectionLabel label="PACTS" />
          {currentPacts.length === 0 ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/pact/new', params: { circleId } })
              }
              accessibilityRole="button"
              accessibilityLabel="Start a pact"
              className="flex-row items-center gap-3 bg-card border border-hairline rounded-xl p-4 active:opacity-90"
            >
              <IconCirclePlus size={18} color={colors.moss} strokeWidth={1.5} />
              <View className="flex-1">
                <Text className="text-body text-ink font-medium">Set a pact</Text>
                <Text className="text-caption text-ink-3 mt-0.5">
                  A shared weekly commitment. Three runs, two long walks — whatever you want.
                </Text>
              </View>
            </Pressable>
          ) : (
            <View className="gap-2">
              {currentPacts.map((p) => (
                <PactCard
                  key={p.id}
                  pact={p}
                  myUserId={myUserId || (user?.uid ?? '')}
                  onComplete={() => completeMutation.mutate(p.id)}
                  busy={completeMutation.isPending && completeMutation.variables === p.id}
                />
              ))}
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/pact/new', params: { circleId } })
                }
                accessibilityRole="button"
                accessibilityLabel="Add another pact"
                className="self-start py-2"
              >
                <Text className="text-body-sm text-moss">+ another pact</Text>
              </Pressable>
            </View>
          )}

          {pastPacts.length > 0 ? (
            <>
              <SectionLabel label="EARLIER PACTS" />
              <View className="gap-2">
                {pastPacts.slice(0, 5).map((p) => (
                  <PactCard
                    key={p.id}
                    pact={p}
                    myUserId={myUserId}
                    onComplete={null}
                    busy={false}
                  />
                ))}
              </View>
            </>
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
        </>
      )}
    </Screen>
  );
}

interface PactCardProps {
  pact: ApiPact;
  myUserId: string;
  onComplete: (() => void) | null;
  busy: boolean;
}

function PactCard({ pact, myUserId, onComplete, busy }: PactCardProps) {
  const completedCount = pact.progress.filter((p) => p.completed).length;
  const totalCount = pact.progress.length;
  const mine = pact.progress.find((p) => p.userId === myUserId);
  const isMineDone = mine?.completed ?? false;
  const isPast = !isCurrent(pact);

  return (
    <Card padding="md">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-eyebrow text-ink-3 uppercase">
          {isPast ? 'WRAPPED' : 'CURRENT'}
        </Text>
        <Text className="text-micro text-ink-3">{formatRange(pact)}</Text>
      </View>
      <Text className="text-body text-ink font-medium mt-2">{pact.text}</Text>

      <View className="flex-row items-center gap-1.5 mt-3 flex-wrap">
        {pact.progress.map((p) => (
          <ProgressDot key={p.userId} progress={p} isMe={p.userId === myUserId} />
        ))}
        <Text className="text-caption text-ink-3 ml-2">
          {completedCount} of {totalCount}
        </Text>
      </View>

      {!isPast && onComplete && !isMineDone ? (
        <Pressable
          onPress={onComplete}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Mark complete"
          style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
          className="self-start flex-row items-center gap-2 mt-4"
        >
          <IconCheck size={16} color={colors.moss} strokeWidth={2} />
          <Text className="text-body text-moss font-medium">
            {busy ? 'Marking…' : 'Mark complete'}
          </Text>
        </Pressable>
      ) : !isPast && isMineDone ? (
        <Text className="text-caption text-moss mt-3 font-medium">You're in ✓</Text>
      ) : null}
    </Card>
  );
}

function ProgressDot({ progress, isMe }: { progress: ApiPactProgress; isMe: boolean }) {
  const initial = progress.displayName.trim().charAt(0).toUpperCase() || '·';
  return (
    <View
      accessibilityLabel={`${progress.displayName} ${progress.completed ? 'completed' : 'pending'}`}
      style={{ width: 24, height: 24 }}
      className={`rounded-full items-center justify-center border ${
        progress.completed
          ? 'bg-moss border-moss'
          : isMe
            ? 'bg-moss-bg border-moss-light'
            : 'bg-paper-2 border-hairline-2'
      }`}
    >
      {progress.completed ? (
        <IconCheck size={12} color="#FFFFFF" strokeWidth={2.5} />
      ) : (
        <Text
          className={`text-micro ${isMe ? 'text-moss' : 'text-ink-3'}`}
          style={{ fontWeight: '500' }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
