import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, ChipRow, ErrorText, Field, Header, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { colors, space, type } from '@/theme';

const DURATIONS = [
  { label: 'No end date', days: 0 },
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
];

export default function NewPoll() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [allowChange, setAllowChange] = useState(false);
  const [days, setDays] = useState(3);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2)
      return setErr('Add a question and at least two options');
    setBusy(true);
    try {
      await api.collectives.createPoll(id, {
        question: question.trim(),
        options: opts,
        multipleChoice: multiple,
        allowVoteChange: allowChange,
        expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : undefined,
      });
      router.back();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title="Create Poll" loading={busy} onPress={create} />}>
      <Header title="New Poll" />
      <Field
        label="Question"
        value={question}
        onChangeText={setQuestion}
        placeholder="Which variant are you considering?"
        maxLength={200}
      />
      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>Options</Text>
        {options.map((o, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                value={o}
                onChangeText={(t) => setOptions((xs) => xs.map((x, j) => (j === i ? t : x)))}
                placeholder={`Option ${i + 1}`}
                maxLength={80}
              />
            </View>
            {options.length > 2 ? (
              <Pressable
                onPress={() => setOptions((xs) => xs.filter((_, j) => j !== i))}
                hitSlop={8}
                accessibilityLabel="Remove option"
              >
                <Ionicons name="close-circle" size={22} color={colors.faint} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {options.length < 10 ? (
          <Button
            small
            variant="ghost"
            icon="add"
            title="Add option"
            onPress={() => setOptions((xs) => [...xs, ''])}
          />
        ) : null}
      </View>
      <Toggle label="Allow choosing more than one" value={multiple} onChange={setMultiple} />
      <Toggle label="Let people change their vote" value={allowChange} onChange={setAllowChange} />
      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>Closes after</Text>
        <ChipRow>
          {DURATIONS.map((d) => (
            <Chip
              key={d.days}
              label={d.label}
              active={days === d.days}
              onPress={() => setDays(d.days)}
            />
          ))}
        </ChipRow>
      </View>
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={type.body}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand }} />
    </View>
  );
}
