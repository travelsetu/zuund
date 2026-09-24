import { Ionicons } from '@expo/vector-icons';
import type { FileDto, SharedFileDto, SharedFileType } from '@zuund/shared';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Chip,
  ChipRow,
  Empty,
  ErrorText,
  Field,
  Header,
  Loading,
  Screen,
  type IconName,
} from '@/components/ui';
import { api, errorMessage, type LocalFile } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { ImageViewer, fileSource } from '@/components/ImageViewer';
import { openFile, pickDocument, pickImage } from '@/lib/files';
import { fileSize, shortDate } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type, fonts } from '@/theme';

type Filter = 'ALL' | SharedFileType;
const ICON: Record<SharedFileType, { name: IconName; color: string }> = {
  DOCUMENT: { name: 'document-text', color: colors.red },
  IMAGE: { name: 'image', color: colors.brand },
  LINK: { name: 'link', color: colors.green },
};

/** Mockup 12 — brochures, spec sheets, links members found useful. Not dealer quotes. */
export default function Files() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [draft, setDraft] = useState<{ type: SharedFileType; file?: LocalFile } | null>(null);
  const [viewing, setViewing] = useState<FileDto | null>(null);
  const { data, error, reload, refresh, refreshing } = useFocusData(
    () => api.collectives.files(id),
    [id],
  );
  const shown = useMemo(
    () => (data?.items ?? []).filter((f) => filter === 'ALL' || f.type === filter),
    [data, filter],
  );

  async function start() {
    Alert.alert('Share with the collective', undefined, [
      {
        text: 'Photo',
        onPress: () =>
          pickImage()
            .then((f) => f && setDraft({ type: 'IMAGE', file: f }))
            .catch((e) => Alert.alert('Could not use this photo', errorMessage(e))),
      },
      {
        text: 'Document (PDF)',
        onPress: () =>
          pickDocument()
            .then(
              (f) =>
                f &&
                setDraft({ type: f.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT', file: f }),
            )
            .catch((e) => Alert.alert('Could not use this file', errorMessage(e))),
      },
      { text: 'Link', onPress: () => setDraft({ type: 'LINK' }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function menu(f: SharedFileDto) {
    Alert.alert(f.title, undefined, [
      { text: 'Open', onPress: () => open(f) },
      f.sharer.id === me.id
        ? {
            text: 'Remove',
            style: 'destructive',
            onPress: () =>
              api.collectives
                .removeShared(f.id)
                .then(reload)
                .catch((e) => Alert.alert('Could not remove', errorMessage(e))),
          }
        : {
            text: 'Report',
            style: 'destructive',
            onPress: () =>
              api.reports
                .create({
                  targetType: 'SHARED_FILE',
                  targetId: f.id,
                  reason: 'Inappropriate shared content',
                })
                .then(() => Alert.alert('Reported', 'Thanks — our team will review it.'))
                .catch(() => {}),
          },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const open = (f: SharedFileDto) =>
    f.url
      ? Linking.openURL(f.url)
      : f.file?.mimeType.startsWith('image/')
        ? setViewing(f.file)
        : f.file
          ? openFile(f.file).catch((e) => Alert.alert('Could not open', errorMessage(e)))
          : undefined;

  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      footer={<Button variant="outline" icon="add" title="Upload File" onPress={start} />}
    >
      <Header title="Shared Files" />
      <ChipRow>
        {(['ALL', 'DOCUMENT', 'IMAGE', 'LINK'] as const).map((f) => (
          <Chip
            key={f}
            label={{ ALL: 'All', DOCUMENT: 'Documents', IMAGE: 'Images', LINK: 'Links' }[f]}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ChipRow>
      {!data ? (
        error ? (
          <Text style={type.small}>{error}</Text>
        ) : (
          <Loading />
        )
      ) : shown.length === 0 ? (
        <Empty
          icon="folder-open-outline"
          title="Nothing shared yet"
          body="Share a brochure, a spec sheet or a useful review."
        />
      ) : (
        <View>
          {shown.map((f) => (
            <Pressable
              key={f.id}
              // Pressed: the row lights up and an image preview dims, so the tap is felt.
              style={({ pressed }) => [s.row, pressed && s.rowPressed]}
              onPress={() => open(f)}
              accessibilityRole="button"
            >
              {f.file?.mimeType.startsWith('image/') ? (
                // Images show a preview; tapping opens them full screen.
                <Image source={fileSource(f.file)} style={s.thumb} contentFit="cover" />
              ) : (
                <Ionicons name={ICON[f.type].name} size={30} color={ICON[f.type].color} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={type.h3} numberOfLines={1}>
                  {f.title}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {f.file ? `${fileSize(f.file.sizeBytes)}, ` : f.url ? `${safeHost(f.url)}, ` : ''}
                  shared by {f.sharer.name}
                  {f.sharer.elite ? ' 👑' : ''} on {shortDate(f.createdAt)}
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={() => menu(f)} accessibilityLabel="More">
                <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
      <ImageViewer file={viewing} onClose={() => setViewing(null)} />
      <ShareSheet
        collectiveId={id}
        draft={draft}
        onClose={() => setDraft(null)}
        onShared={() => {
          setDraft(null);
          void reload();
        }}
      />
    </Screen>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return 'link';
  }
}

function ShareSheet({
  collectiveId,
  draft,
  onClose,
  onShared,
}: {
  collectiveId: string;
  draft: { type: SharedFileType; file?: LocalFile } | null;
  onClose: () => void;
  onShared: () => void;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (!draft) return;
    setBusy(true);
    setErr(null);
    try {
      const fileId = draft.file ? (await api.files.upload(draft.file)).id : undefined;
      await api.collectives.shareFile(collectiveId, {
        type: draft.type,
        title: title.trim() || draft.file?.name || 'Link',
        description: description.trim() || undefined,
        fileId,
        url: draft.type === 'LINK' ? url.trim() : undefined,
      });
      setTitle('');
      setUrl('');
      setDescription('');
      onShared();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={!!draft}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg, gap: space.lg }}
      >
        <Header
          title={draft?.type === 'LINK' ? 'Share a link' : 'Share a file'}
          back={false}
          right={
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>Cancel</Text>
            </Pressable>
          }
        />
        {draft?.file ? <Text style={type.small}>File: {draft.file.name}</Text> : null}
        {draft?.type === 'LINK' ? (
          <Field
            label="URL"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://"
          />
        ) : null}
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder={draft?.file?.name ?? 'e.g. Creta comparison review'}
          maxLength={120}
        />
        <Field
          label="Note (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
        />
        <Text style={type.tiny}>
          Share buyer information only — no dealer quotations or offers.
        </Text>
        <ErrorText>{err}</ErrorText>
        <Button title="Share" loading={busy} onPress={share} />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    // Inset so the pressed highlight has room, pulled back out so content stays aligned.
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: 10,
  },
  rowPressed: { backgroundColor: colors.brandSoft },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.canvas },
});
