import { ACTIVITY_TYPES, type ActivityDto, type ActivityType } from '@zuund/shared';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  Empty,
  ErrorText,
  Field,
  Header,
  Loading,
  Screen,
  StatusBadge,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type, fonts } from '@/theme';

const TYPE_LABEL: Record<ActivityType, string> = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  HYBRID: 'Hybrid',
};

/** Meetups and group calls. Meeting links are external (Meet/Zoom); no video built in. */
export default function Activities() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const [creating, setCreating] = useState(false);
  const { data, setData, error, reload, refresh, refreshing } = useFocusData(
    () => api.collectives.activities(id),
    [id],
  );
  const replace = (a: ActivityDto) =>
    data && setData({ ...data, items: data.items.map((x) => (x.id === a.id ? a : x)) });

  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      footer={<Button icon="add" title="Plan an activity" onPress={() => setCreating(true)} />}
    >
      <Header title="Activities" />
      {!data ? (
        error ? (
          <Text style={type.small}>{error}</Text>
        ) : (
          <Loading />
        )
      ) : data.items.length === 0 ? (
        <Empty
          icon="calendar-outline"
          title="Nothing planned"
          body="Set up a group call or a buyer meetup."
        />
      ) : (
        data.items.map((a) => (
          <Card key={a.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <StatusBadge label={TYPE_LABEL[a.type]} tone="blue" />
              {a.status !== 'SCHEDULED' ? <StatusBadge label={a.status} tone="grey" /> : null}
            </View>
            <Text style={type.h3}>{a.title}</Text>
            <Text style={type.small}>
              {new Date(`${a.date}T00:00:00`).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              , {a.startTime}
              {a.endTime ? `–${a.endTime}` : ''}
              {'\n'}
              {a.goingCount} going
            </Text>
            {a.description ? <Text style={type.body}>{a.description}</Text> : null}
            {a.location ? <Text style={type.small}>📍 {a.location}</Text> : null}
            {a.meetingLink ? (
              <Pressable onPress={() => Linking.openURL(a.meetingLink!)}>
                <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>
                  Join meeting link
                </Text>
              </Pressable>
            ) : null}
            {a.status === 'SCHEDULED' ? (
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 4 }}>
                <Button
                  small
                  variant={a.myStatus === 'GOING' ? 'green' : 'outline'}
                  title="Going"
                  onPress={() =>
                    api.collectives
                      .rsvp(a.id, 'GOING')
                      .then(replace)
                      .catch((e) => Alert.alert('', errorMessage(e)))
                  }
                />
                <Button
                  small
                  variant={a.myStatus === 'NOT_GOING' ? 'primary' : 'outline'}
                  title="Can't go"
                  onPress={() =>
                    api.collectives
                      .rsvp(a.id, 'NOT_GOING')
                      .then(replace)
                      .catch((e) => Alert.alert('', errorMessage(e)))
                  }
                />
                {a.creator.id === me.id ? (
                  <Button
                    small
                    variant="ghost"
                    title="Cancel"
                    onPress={() =>
                      api.collectives
                        .cancelActivity(a.id)
                        .then(replace)
                        .catch((e) => Alert.alert('', errorMessage(e)))
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        ))
      )}
      <NewActivity
        collectiveId={id}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void reload();
        }}
      />
    </Screen>
  );
}

function NewActivity({
  collectiveId,
  open,
  onClose,
  onCreated,
}: {
  collectiveId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<ActivityType>('ONLINE');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [link, setLink] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      await api.collectives.createActivity(collectiveId, {
        title: title.trim(),
        type: kind,
        date: date.trim(),
        startTime: start.trim(),
        endTime: end.trim() || undefined,
        meetingLink: link.trim() || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });
      onCreated();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Screen
          edges={[]}
          footer={<Button title="Create activity" loading={busy} onPress={create} />}
        >
          <Header
            title="New activity"
            back={false}
            right={
              <Pressable onPress={onClose}>
                <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>Cancel</Text>
              </Pressable>
            }
          />
          <ChipRow>
            {ACTIVITY_TYPES.map((t) => (
              <Chip key={t} label={TYPE_LABEL[t]} active={kind === t} onPress={() => setKind(t)} />
            ))}
          </ChipRow>
          <Field
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Weekend test-drive meetup"
            maxLength={120}
          />
          <Field
            label="Date"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Starts"
                value={start}
                onChangeText={setStart}
                placeholder="HH:MM"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Ends (optional)"
                value={end}
                onChangeText={setEnd}
                placeholder="HH:MM"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          {kind !== 'IN_PERSON' ? (
            <Field
              label="Meeting link"
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://meet.google.com/…"
            />
          ) : null}
          {kind !== 'ONLINE' ? (
            <Field
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Public place, e.g. a café"
            />
          ) : null}
          <Field
            label="Details (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <ErrorText>{err}</ErrorText>
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}
