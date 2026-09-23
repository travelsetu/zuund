import { router } from 'expo-router';
import { Text } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { Button, Empty, Header, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';
import { type } from '@/theme';

/** Every Buying Post, including closed and expired ones — history is kept (spec §11). */
export default function MyPosts() {
  const { data, refresh, refreshing } = useFocusData(() => api.intents.list());
  const live = data?.items.filter((i) => i.status === 'ACTIVE' || i.status === 'PAUSED') ?? [];
  const past = data?.items.filter((i) => i.status === 'CLOSED' || i.status === 'EXPIRED') ?? [];
  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        <Button title="Create Buying Post" icon="add" onPress={() => router.push('/search')} />
      }
    >
      <Header title="My Buying Posts" />
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty
          icon="document-text-outline"
          title="No Buying Posts yet"
          body="Tell us what you want to buy — it's free."
        />
      ) : (
        <>
          {live.map((i) => (
            <PostCard key={i.id} intent={i} />
          ))}
          {past.length ? <Text style={type.h3}>History</Text> : null}
          {past.map((i) => (
            <PostCard key={i.id} intent={i} />
          ))}
        </>
      )}
    </Screen>
  );
}
