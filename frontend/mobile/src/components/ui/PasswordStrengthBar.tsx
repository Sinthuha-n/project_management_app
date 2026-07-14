import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { PASSWORD_REQUIREMENTS } from '../../lib/validation';
import { Colors } from '../../constants/colors';

const STRENGTH_COLORS = ['#E5E7EB', '#F87171', '#FBBF24', '#34D399', '#10B981'] as const;
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;

type Props = {
  strength: 0 | 1 | 2 | 3 | 4;
  password: string;
};

export default function PasswordStrengthBar({ strength, password }: Props) {
  const barAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    barAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: strength >= i + 1 ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
  }, [barAnims, strength]);

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {[0, 1, 2, 3].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                backgroundColor: barAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#E5E7EB', STRENGTH_COLORS[strength] || '#E5E7EB'],
                }),
              },
            ]}
          />
        ))}
      </View>
      {strength > 0 && (
        <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>
          {STRENGTH_LABELS[strength]}
        </Text>
      )}
      <View style={styles.requirements}>
        {PASSWORD_REQUIREMENTS.map(req => {
          const met = req.test(password);
          return (
            <View key={req.label} style={styles.reqRow}>
              <Text style={[styles.reqIcon, { color: met ? Colors.successGreen : Colors.textMuted }]}>
                {met ? '✓' : '✗'}
              </Text>
              <Text style={[styles.reqLabel, { color: met ? Colors.successGreen : Colors.textMuted }]}>
                {req.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  bars: {
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 5,
    borderRadius: 4,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  requirements: {
    marginTop: 8,
    gap: 4,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  reqLabel: {
    fontSize: 12,
  },
});
