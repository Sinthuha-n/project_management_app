import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { NativeShadow, T } from '../../constants/tokens';

interface SurfaceCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function SurfaceCard({ children, style, accessibilityLabel }: SurfaceCardProps) {
  return (
    <View style={[styles.card, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.bg,
    borderColor: T.border,
    borderWidth: 1,
    borderRadius: T.radius2xl,
    padding: T.space4,
    ...NativeShadow.card,
  },
});
