import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  ActivityIndicator,
  Text,
  Platform,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { shouldUseNativeDriver } from '../../lib/platform';

type Props = {
  onPress: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  accessibilityHint?: string;
  testID?: string;
};

export default function PrimaryButton({
  onPress,
  label,
  loading = false,
  disabled = false,
  variant = 'primary',
  accessibilityHint,
  testID,
}: Props) {
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: shouldUseNativeDriver }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: shouldUseNativeDriver }).start();
  };

  const handlePress = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Ignore haptics error if not supported in simulator/environment
      }
    }
    onPress();
  };

  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Animated.View
      style={[
        styles.wrap,
        isPrimary && styles.wrapPrimary,
        { elevation: isPrimary && !isDisabled ? 8 : 0 },
        isDisabled && styles.disabled,
        { transform: [{ scale: pressAnim }] },
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientMid]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.base}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            testID={testID}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
            style={styles.pressableFill}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={[styles.label, styles.labelPrimary]}>{label}</Text>
            )}
          </Pressable>
        </LinearGradient>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: isDisabled, busy: loading }}
          testID={testID}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          style={[styles.base, styles.outline]}
        >
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={[styles.label, styles.labelOutline]}>{label}</Text>
          )}
        </Pressable>
      )}
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
  },
  wrapPrimary: {
    ...Platform.select({
      web: {},
      default: {
        shadowColor: Colors.gradientMid,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.40,
        shadowRadius: 16,
      },
    }),
  },
  base: {
    minHeight: 56,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 8px 16px rgba(152, 16, 250, 0.40)' },
      default: {},
    }),
  },
  pressableFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Platform.select({ web: { boxShadow: 'none' }, default: {} }),
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelPrimary: {
    color: Colors.white,
  },
  labelOutline: {
    color: Colors.primary,
  },
});
