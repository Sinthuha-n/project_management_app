import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors } from '@/src/constants/colors';

interface Props {
  isOnline: boolean;
  isStale: boolean;
}

function OfflineStaleBanner({ isOnline, isStale }: Props) {
  const height = useSharedValue(0);
  const showBanner = !isOnline || isStale;

  useEffect(() => {
    height.value = withTiming(showBanner ? 38 : 0, { duration: 250 });
  }, [height, showBanner]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    overflow: 'hidden',
  }));

  if (!showBanner) return null;

  const isOffline = !isOnline;
  const bgColor = isOffline ? Colors.bannerRedBg : Colors.bannerAmberBg;
  const borderColor = isOffline ? Colors.bannerRedBorder : Colors.bannerAmberBorder;
  const textColor = isOffline ? Colors.bannerRedText : Colors.bannerAmberText;
  const iconName = isOffline ? 'cloud-offline-outline' : 'warning-outline';
  const message = isOffline
    ? 'Offline Mode. Changes will be synced when online.'
    : 'Showing cached data. Pull down to refresh.';

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[animatedStyle, { backgroundColor: bgColor, borderBottomColor: borderColor, borderBottomWidth: 1 }]}
    >
      <View style={styles.banner}>
        <Ionicons name={iconName} size={14} color={textColor} />
        <Text style={[styles.message, { color: textColor }]} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 37,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  message: {
    fontSize: 12,
    fontWeight: '600',
  },
});
export default OfflineStaleBanner;
