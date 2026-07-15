import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { shouldUseNativeDriver } from '../../lib/platform';

type Props = {
  message: string;
  visible: boolean;
};

export default function ErrorBanner({ message, visible }: Props) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: shouldUseNativeDriver }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: shouldUseNativeDriver }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(8);
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.banner, { opacity, transform: [{ translateY }] }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.errorRedBg,
    borderWidth: 1,
    borderColor: Colors.errorRedBorder,
    borderRadius: 12,
    padding: 12,
  },
  text: {
    color: Colors.errorRed,
    fontSize: 14,
  },
});
