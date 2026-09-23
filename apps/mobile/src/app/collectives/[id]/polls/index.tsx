import { Ionicons } from '@expo/vector-icons';
import type { PollDto } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Empty, Header, Loading, Screen, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { daysLeft, formatDate } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type, fonts } from '@/theme';

export default function Polls() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refresh, refreshing } = useFocusData(() => api.collectives.polls(id), [id]);
  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        <Button
          title="Create Poll"
          icon="add"
          onPress={() => router.push(`/collectives/${id}/polls/new`)}
        />
      }
    >
      <Header title="Polls & Decisions" />
      {!data ? (
        error ? (
          <Text style={type.small}>{error}</Text>
        ) : (
          <Loading />
        )
      ) : data.items.length === 0 ? (
        <Empty
          icon="stats-chart-outline"
          title="No polls yet"
          body="Ask the group — which variant, which colour, petrol or diesel?"
        />
      ) : (
        data.items.map((p) => <PollCard key={p.id} p={p} collectiveId={id} />)
      )}
    </Screen>
  );
}

function PollCard({ p, collectiveId }: { p: PollDto; collectiveId: string }) {
  const left = daysLeft(p.expiresAt);
  const voted = p.options.some((o) => o.voted);
  return (
    <Pressable
      onPress={() => router.push(`/collectives/${collectiveId}/polls/${p.id}`)}
      accessibilityRole="button"
    >
      <Card style={{ gap: space.sm }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <StatusBadge
            label={p.status === 'ACTIVE' ? 'Active' : 'Closed'}
            tone={p.status === 'ACTIVE' ? 'green' : 'grey'}
          />
          {voted ? <Text style={[type.tiny, { color: colors.green }]}>You voted</Text> : null}
        </View>
        <Text style={type.h3}>{p.question}</Text>
        <Text style={type.small}>
          Asked by {p.creator.name} on {formatDate(p.createdAt)}
          {'\n'}
          {p.totalVotes} {p.totalVotes === 1 ? 'vote' : 'votes'}
          {p.status === 'ACTIVE' && left !== null
            ? `, ${left} ${left === 1 ? 'day' : 'days'} left`
            : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>
            {p.status === 'ACTIVE' && !voted ? 'Vote now' : 'See results'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.brand} />
        </View>
      </Card>
    </Pressable>
  );
}
