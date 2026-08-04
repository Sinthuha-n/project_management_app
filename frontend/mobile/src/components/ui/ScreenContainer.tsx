import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../../constants/tokens';

interface ScreenContainerProps extends PropsWithChildren {
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps['refreshControl'];
  testID?: string;
}

export function ScreenContainer({
  children,
  scroll = false,
  contentStyle,
  refreshControl,
  testID,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']} testID={testID}>
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.content, contentStyle]}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bgSecondary },
  fill: { flex: 1 },
  content: { paddingHorizontal: T.space4, paddingBottom: T.space8 },
});
