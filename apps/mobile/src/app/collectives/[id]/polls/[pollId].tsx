import type { PollDto } from '@zuund/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Button, Header, Loading, Screen, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { daysLeft, formatDate } from '@/lib/format';
import { colors, radius, space, type, fonts } from '@/theme';

/**
 * Mockup 11 — one poll. Single-choice allows one vote; changing it is possible
 * only when the creator enabled it (the server enforces both).
 */
export default function PollDetail() {
  const { pollId, id } = useLocalSearchParams<{ pollId: string; id: string }>();
  const me = useMe();
  const [poll, setPoll] = useState<PollDto | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  // There is no single-poll endpoint; find it in the collective's list.
  const load = useCallback(async () => {
    let cursor: string | undefined;
    do {
      const page = await api.collectives.polls(id, cursor);
      const hit = page.items.find((p) => p.id === pollId);
      if (hit) return setPoll(hit);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }, [id, pollId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  if (!poll)
    return (
      <Screen>
        <Header title="Poll Details" />
        <Loading />
      </Screen>
    );
  const voted = poll.options.some((o) => o.voted);
  const canVote = poll.status === 'ACTIVE' && (!voted || (poll.allowVoteChange && editing));
  const left = daysLeft(poll.expiresAt);

  const toggle = (optionId: string) =>
    setPicked((cur) =>
      poll.multipleChoice
        ? cur.includes(optionId)
          ? cur.filter((x) => x !== optionId)
          : [...cur, optionId]
        : [optionId],
    );

  async function vote() {
    setBusy(true);
    try {
      setPoll(await api.collectives.vote(poll!.id, picked));
      setEditing(false);
      setPicked([]);
    } catch (e) {
      Alert.alert('Vote not counted', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        canVote ? (
          <Button
            title={voted ? 'Save vote' : 'Vote'}
            disabled={picked.length === 0}
            loading={busy}
            onPress={vote}
          />
        ) : voted && poll.allowVoteChange && poll.status === 'ACTIVE' ? (
          <Button
            title="Change Vote"
            onPress={() => {
              setEditing(true);
              setPicked(poll.options.filter((o) => o.voted).map((o) => o.id));
            }}
          />
        ) : poll.creator.id === me.id && poll.status === 'ACTIVE' ? (
          <Button
            variant="outline"
            title="Close poll"
            onPress={() =>
              api.collectives
                .closePoll(poll.id)
                .then(setPoll)
                .catch((e) => Alert.alert('Could not close', errorMessage(e)))
            }
          />
        ) : undefined
      }
    >
      <Header
        title="Poll Details"
        right={
          <StatusBadge
            label={poll.status === 'ACTIVE' ? 'Active' : 'Closed'}
            tone={poll.status === 'ACTIVE' ? 'green' : 'grey'}
          />
        }
      />
      <View style={{ gap: 4 }}>
        <Text style={type.h2}>{poll.question}</Text>
        <Text style={type.small}>
          Asked by {poll.creator.name} on {formatDate(poll.createdAt)}
        </Text>
        <Text style={type.tiny}>
          {poll.multipleChoice ? 'Choose one or more.' : 'Choose one.'}
          {poll.allowVoteChange ? ' You can change your vote.' : ' Votes are final.'}
        </Text>
      </View>
      <View style={{ gap: space.lg }}>
        {poll.options.map((o) => {
          const pct = poll.totalVotes ? Math.round((o.voteCount / poll.totalVotes) * 100) : 0;
          const on = canVote ? picked.includes(o.id) : o.voted;
          return (
            <Pressable
              key={o.id}
              disabled={!canVote}
              onPress={() => toggle(o.id)}
              style={{ gap: 6 }}
              accessibilityRole={poll.multipleChoice ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {canVote ? (
                  <View
                    style={[s.mark, poll.multipleChoice && { borderRadius: 4 }, on && s.markOn]}
                  />
                ) : null}
                <Text style={[type.body, { flex: 1, fontFamily: on ? fonts.bold : fonts.medium }]}>
                  {o.label}
                  {!canVote && o.voted ? '  (your vote)' : ''}
                </Text>
                <Text style={type.small}>
                  {o.voteCount} ({pct}%)
                </Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { width: `${pct}%` }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={type.small}>Total votes: {poll.totalVotes}</Text>
        {poll.status === 'ACTIVE' && left !== null ? (
          <Text style={type.small}>
            {left} {left === 1 ? 'day' : 'days'} left
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.green, borderRadius: radius.pill },
  mark: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.faint },
  markOn: { borderColor: colors.brand, backgroundColor: colors.brand },
});
