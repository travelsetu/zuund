import { Ionicons } from '@expo/vector-icons';
import { PURCHASE_TIMELINE_LABELS, type BuyingIntentDto } from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, space, type } from '@/theme';
import { Card, ProductArt, StatusBadge } from './ui';

export function PostCard({ intent }: { intent: BuyingIntentDto }) {
  return (
    <Pressable onPress={() => router.push(`/posts/${intent.id}`)} accessibilityRole="button">
      <Card
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}
      >
        <ProductArt car={intent.car} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={type.h3} numberOfLines={1}>
            {intent.car.displayName}
          </Text>
          <Text style={type.small}>
            {intent.city.name}, {PURCHASE_TIMELINE_LABELS[intent.purchaseTimeline].toLowerCase()}
          </Text>
          {intent.status !== 'ACTIVE' ? (
            <StatusBadge
              label={intent.status[0] + intent.status.slice(1).toLowerCase()}
              tone={intent.status === 'PAUSED' ? 'orange' : 'grey'}
            />
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Card>
    </Pressable>
  );
}
