import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const RADIUS = 48;
const STROKE_WIDTH = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUSES = [
  { key: 'TODO', label: 'To Do', color: '#D1D5DB' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#3B82F6' },
  { key: 'IN_REVIEW', label: 'In Review', color: '#F59E0B' },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function StatusDonutChart({ items }: { items: { status?: string | null }[] }) {
  // ── Calculate slice proportions
  const { counts, total, slices } = useMemo(() => {
    const calculatedCounts = STATUSES.map(s => ({
      ...s,
      count: (items || []).filter(i => i.status === s.key).length,
    }));
    
    const totalCount = calculatedCounts.reduce((acc, curr) => acc + curr.count, 0);
    
    const computedSlices = calculatedCounts.map((slice, index, arr) => {
      const proportion = totalCount > 0 ? slice.count / totalCount : 0;
      const currentOrigin = arr
        .slice(0, index)
        .reduce((sum, s) => sum + (totalCount > 0 ? s.count / totalCount : 0), 0);
        
      return { 
        ...slice, 
        proportion, 
        currentOrigin, 
        dashLength: proportion * CIRCUMFERENCE 
      };
    });
    
    return { counts: calculatedCounts, total: totalCount, slices: computedSlices };
  }, [items]);

  // ── Animations
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entranceAnim.setValue(0);
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();

    // Infinite subtle rotation
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [entranceAnim, items, rotationAnim]);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '270deg'],
  });

  if (total === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCircle}>
          <Svg width="100%" height="100%" viewBox="0 0 120 120">
            <Circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#F1F5F9" strokeWidth={STROKE_WIDTH} strokeDasharray="6 6" />
          </Svg>
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyText}>No Active</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Donut Chart ── */}
      <View style={styles.chartWrap}>
        <Animated.View style={[styles.svgContainer, { transform: [{ rotate: spin }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 120 120">
            {/* Background Track */}
            <Circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#F8FAFC" strokeWidth={STROKE_WIDTH} />
            
            {/* Slices */}
            {slices.map((slice, index) => {
              if (slice.count === 0) return null;
              
              // Animated Dash Array approach (fade in dash length)
              // Wait, RN SVG Animated component needs numeric values usually, so we animate strokeDashoffset
              // to "draw" the circle.
              const strokeDashoffset = entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [CIRCUMFERENCE, -slice.currentOrigin * CIRCUMFERENCE],
              });

              return (
                <AnimatedCircle
                  key={slice.key}
                  cx="60" cy="60" r={RADIUS}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeDasharray={`${slice.dashLength} ${CIRCUMFERENCE}`}
                  strokeDashoffset={strokeDashoffset}
                />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Center Metric */}
        <Animated.View style={[styles.centerMetric, { opacity: entranceAnim }]}>
          <Text style={styles.centerNumber}>{total}</Text>
          <Text style={styles.centerLabel}>ACTIVE</Text>
        </Animated.View>
      </View>

      {/* ── Legend ── */}
      <Animated.View style={[styles.legend, { opacity: entranceAnim, transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        {counts.map(slice => (
          <View key={slice.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendLabel}>{slice.label} ({slice.count})</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
    backgroundColor: '#FAFBFF',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  chartWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  centerMetric: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 32,
  },
  centerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
  legend: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 14,
    marginTop: 0,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
