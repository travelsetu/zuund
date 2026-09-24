import { Ionicons } from '@expo/vector-icons';
import type { FileDto, MessageDto } from '@zuund/shared';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '@/lib/alert';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { atLeast } from '@/lib/minDuration';
import { openFile, pickDocument, pickImage } from '@/lib/files';
import { clockTime } from '@/lib/format';
import { colors, radius, space, type, fonts } from '@/theme';
import { EliteBadge } from './Plan';
import { ImageViewer, fileSource } from './ImageViewer';
import { Preloader } from './Preloader';
import { Avatar } from './ui';

const POLL_MS = 5000;

/**
 * Chat used for direct messages and collective discussion. Messages arrive by
 * polling (Phase 1 decision); the server records delivered/read state.
 */
export function MessageThread({
  conversationId,
  showNames,
  readOnly,
}: {
  conversationId: string;
  showNames: boolean;
  /** History only (a pass has ended): shown in place of the composer. */
  readOnly?: ReactNode;
}) {
  const me = useMe();
  const insets = useSafeAreaInsets();
  // The home-indicator gap shrinks in step with the keyboard (progress 0 → 1), so the
  // composer never drops to the edge and then jumps back up when the keyboard hides.
  const { progress } = useReanimatedKeyboardAnimation();
  const composerInset = useAnimatedStyle(() => ({
    paddingBottom: space.sm + insets.bottom * (1 - progress.value),
  }));
  const [items, setItems] = useState<MessageDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [viewing, setViewing] = useState<FileDto | null>(null);
  const loadingOlder = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const firstPoll = useRef(true);

  const merge = useCallback((incoming: MessageDto[], older = false) => {
    setItems((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
    if (older) loadingOlder.current = false;
  }, []);

  const poll = useCallback(async () => {
    try {
      const request = api.conversations.messages(conversationId);
      const page = firstPoll.current ? await atLeast(request) : await request;
      firstPoll.current = false;
      merge(page.items);
      setLoaded(true);
      setCursor((c) => c ?? page.nextCursor);
      setErr(null);
      if (!readOnly) await api.conversations.markRead(conversationId);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [conversationId, merge, readOnly]);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  async function older() {
    if (!cursor || loadingOlder.current) return;
    loadingOlder.current = true;
    const page = await api.conversations.messages(conversationId, cursor).catch(() => null);
    if (!page) return void (loadingOlder.current = false);
    merge(page.items, true);
    setCursor(page.nextCursor);
  }

  async function send(attachmentId?: string) {
    const content = text.trim();
    if (!content && !attachmentId) return;
    setSending(true);
    try {
      const m = await api.conversations.send(conversationId, {
        content,
        attachmentId,
        replyToId: replyTo?.id,
      });
      merge([m]);
      setText('');
      setReplyTo(null);
    } catch (e) {
      Alert.alert('Not sent', errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function attach() {
    const choose = (i: number) =>
      i === 0 ? pickImage() : i === 1 ? pickDocument() : Promise.resolve(null);
    const run = async (i: number) => {
      try {
        const f = await choose(i);
        if (!f) return;
        setSending(true);
        const up = await api.files.upload(f);
        await send(up.id);
      } catch (e) {
        Alert.alert('Upload failed', errorMessage(e));
        setSending(false);
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Photo', 'Document (PDF)', 'Cancel'], cancelButtonIndex: 2 },
        run,
      );
    } else {
      Alert.alert('Attach', undefined, [
        { text: 'Photo', onPress: () => run(0) },
        { text: 'Document (PDF)', onPress: () => run(1) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function actions(m: MessageDto) {
    if (m.deletedAt) return;
    const mine = m.sender.id === me.id;
    const opts: Array<{ label: string; run: () => void; destructive?: boolean }> = [
      {
        label: '👍 React',
        run: () =>
          api.conversations
            .react(m.id, '👍')
            .then(poll)
            .catch(() => {}),
      },
      { label: 'Reply', run: () => setReplyTo(m) },
      mine
        ? {
            label: 'Delete',
            destructive: true,
            run: () =>
              api.conversations
                .remove(m.id)
                .then(poll)
                .catch(() => {}),
          }
        : {
            label: 'Report',
            destructive: true,
            run: () =>
              api.reports
                .create({ targetType: 'MESSAGE', targetId: m.id, reason: 'Inappropriate message' })
                .then(() => Alert.alert('Reported', 'Thanks — our team will review it.'))
                .catch((e) => Alert.alert('Could not report', errorMessage(e))),
          },
    ];
    Alert.alert('Message', undefined, [
      ...opts.map((o) => ({
        text: o.label,
        onPress: o.run,
        style: o.destructive ? ('destructive' as const) : ('default' as const),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  const byId = new Map(items.map((m) => [m.id, m]));

  return (
    // Keyboard avoidance lives in <ChatScreen>, around the whole screen.
    <View style={{ flex: 1 }}>
      {!loaded && !err ? <Preloader fill label="Loading messages…" /> : null}
      <FlatList
        style={!loaded && !err ? { display: 'none' } : undefined}
        inverted
        data={items}
        keyExtractor={(m) => m.id}
        onEndReached={older}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        ListFooterComponent={
          err ? <Text style={[type.small, { textAlign: 'center' }]}>{err}</Text> : null
        }
        renderItem={({ item }) => (
          <Bubble
            m={item}
            mine={item.sender.id === me.id}
            showName={showNames}
            replied={item.replyToId ? byId.get(item.replyToId) : undefined}
            onLongPress={() => actions(item)}
            onViewImage={setViewing}
          />
        )}
      />
      {replyTo ? (
        <View style={s.replyBar}>
          <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
            Replying to {replyTo.sender.name}: {replyTo.content}
          </Text>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {readOnly ? (
        <Animated.View style={[s.composer, composerInset]}>{readOnly}</Animated.View>
      ) : (
        <Animated.View style={[s.composer, composerInset]}>
          <Pressable
            onPress={attach}
            hitSlop={8}
            accessibilityLabel="Attach a file"
            disabled={sending}
          >
            <Ionicons name="attach" size={26} color={colors.muted} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={colors.faint}
            style={s.input}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={() => send()}
            disabled={sending || !text.trim()}
            style={[s.send, (sending || !text.trim()) && { opacity: 0.5 }]}
            accessibilityLabel="Send"
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </Animated.View>
      )}
      <ImageViewer file={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

function Bubble({
  m,
  mine,
  showName,
  replied,
  onLongPress,
  onViewImage,
}: {
  m: MessageDto;
  mine: boolean;
  showName: boolean;
  replied?: MessageDto;
  onLongPress: () => void;
  onViewImage: (f: FileDto) => void;
}) {
  const fg = mine ? colors.white : colors.text;
  const a = m.attachment;
  return (
    <View
      style={{ flexDirection: 'row', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start' }}
    >
      {!mine && showName ? <Avatar user={m.sender} size={34} /> : null}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        style={[s.bubble, mine ? s.mine : s.theirs]}
      >
        {!mine && showName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.bold, color: colors.ink, fontSize: 13 }}>
              {m.sender.name} <Text style={type.tiny}>{clockTime(m.createdAt)}</Text>
            </Text>
            {m.sender.elite ? <EliteBadge small /> : null}
          </View>
        ) : null}
        {replied ? (
          <View style={[s.quote, mine && { borderLeftColor: colors.white }]}>
            <Text style={{ color: fg, opacity: 0.8, fontSize: 12 }} numberOfLines={2}>
              {replied.sender.name}: {replied.content || 'Attachment'}
            </Text>
          </View>
        ) : null}
        {m.deletedAt ? (
          <Text style={{ color: fg, fontStyle: 'italic', opacity: 0.7 }}>Message deleted</Text>
        ) : (
          <>
            {a && a.mimeType.startsWith('image/') ? (
              <Pressable
                onPress={() => onViewImage(a)}
                style={({ pressed }) => pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }}
                accessibilityLabel="Open image"
              >
                <Image
                  source={fileSource(a, 'thumb')}
                  style={{ width: 200, height: 150, borderRadius: radius.sm }}
                  contentFit="cover"
                />
              </Pressable>
            ) : a ? (
              <Pressable
                style={s.file}
                onPress={() =>
                  openFile(a).catch((e) => Alert.alert('Could not open', errorMessage(e)))
                }
              >
                <Ionicons name="document-text" size={20} color={mine ? colors.white : colors.red} />
                <Text style={{ color: fg, flexShrink: 1 }} numberOfLines={1}>
                  {a.fileName}
                </Text>
              </Pressable>
            ) : null}
            {m.content ? (
              <Text style={{ color: fg, fontSize: 15, lineHeight: 20 }}>{m.content}</Text>
            ) : null}
          </>
        )}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
        >
          {m.reactions.map((r) => (
            <Text key={r.emoji} style={{ fontSize: 12, color: fg }}>
              {r.emoji} {r.count}
            </Text>
          ))}
          {mine || !showName ? (
            <Text style={{ fontSize: 10, color: fg, opacity: 0.7 }}>{clockTime(m.createdAt)}</Text>
          ) : null}
          {mine ? (
            <Ionicons
              name={m.deliveryState === 'SENT' ? 'checkmark' : 'checkmark-done'}
              size={13}
              color={m.deliveryState === 'READ' ? '#9BE7B4' : colors.white}
              accessibilityLabel={m.deliveryState.toLowerCase()}
            />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bubble: { maxWidth: '80%', borderRadius: radius.lg, padding: space.md, gap: 4 },
  mine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  theirs: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.brand, paddingLeft: 8 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  input: {
    letterSpacing: 0,
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    backgroundColor: colors.canvas,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.ink,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    backgroundColor: colors.brandSoft,
  },
});

/**
 * Full-screen shell for a chat. The keyboard-avoiding view must be the outermost
 * element: it measures its own position relative to its parent, so nested under a
 * header and the top safe area it under-counts and the keyboard covers the composer.
 * keyboard-controller measures the real keyboard on iOS and Android (edge-to-edge
 * Android no longer resizes the window, so React Native's own version cannot).
 */
export function ChatScreen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior="padding">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
