import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/tokens';

interface StateViewProps {
  title: string;
  message?: string;
  loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  actionLabel?: string;
  onAction?: () => void;
}

export function StateView({ title, message, loading, icon = 'folder-open-outline', actionLabel, onAction }: StateViewProps) {
  return (
    <View style={styles.container} accessibilityRole={loading ? 'progressbar' : 'summary'}>
      {loading ? <ActivityIndicator color={T.primary} size="large" /> : <Ionicons name={icon} size={40} color={T.textMuted} />}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: T.space6 },
  title: { color: T.textPrimary, fontSize: T.fontBodyLarge, fontWeight: '800', textAlign: 'center', marginTop: T.space3 },
  message: { color: T.textSecondary, fontSize: T.fontBody, lineHeight: 20, textAlign: 'center', marginTop: T.space2 },
  action: { minHeight: T.touchComfortable, justifyContent: 'center', paddingHorizontal: T.space5, borderRadius: T.radiusXl, backgroundColor: T.primary, marginTop: T.space4 },
  actionText: { color: T.textInverse, fontSize: T.fontBody, fontWeight: '800' },
  pressed: { opacity: 0.82 },
});
