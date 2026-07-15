/**
 * DonutPriorityChart — Animated SVG donut, light theme.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const CFG: Record<string, { color: string; label: string }> = {
  URGENT: { color: '#EF4444', label: 'Urgent' },
  HIGH:   { color: '#F59E0B', label: 'High'   },
  MEDIUM: { color: '#155DFC', label: 'Medium'  },
  LOW:    { color: '#00875A', label: 'Low'     },
};

const SIZE = 140, STROKE = 13, R = SIZE / 2 - STROKE, C = 2 * Math.PI * R;
const AnimCircle = Animated.createAnimatedComponent(Circle);

export function DonutPriorityChart({ tasks }: { tasks: { priority?: string }[] }) {
  const anim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  const segments = useMemo(() => {
    const total = tasks.length || 1;
    const counts: Record<string, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    tasks.forEach(t => {
      const p = (t.priority || 'MEDIUM').toUpperCase();
      if (counts[p] !== undefined) counts[p]++; else counts['MEDIUM']++;
    });
    let offset = 0;
    return Object.entries(counts).filter(([, c]) => c > 0).map(([key, count]) => {
      const pct = count / total;
      const seg = { key, count, pct, offset };
      offset += pct;
      return seg;
    });
  }, [tasks]);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: false }).start();
    
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [anim, rotationAnim, tasks.length]);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={st.wrap}>
      {/* Donut */}
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: spin }] }]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#F1F5F9" strokeWidth={STROKE} />
            {[...segments].sort((a, b) => b.count - a.count).map(seg => {
              return (
                <AnimCircle key={seg.key}
                  cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
                  stroke={CFG[seg.key]?.color || '#155DFC'} strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${seg.pct * C} ${C}`}
                  strokeDashoffset={-(seg.offset * C)}
                  transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
                />
              );
            })}
          </Svg>
        </Animated.View>
        <Text style={st.centerNum}>{tasks.length}</Text>
        <Text style={st.centerSub}>Tasks</Text>
      </View>

      {/* Legend */}
      <View style={st.legend}>
        {segments.map(seg => {
          const cfg = CFG[seg.key] || CFG['MEDIUM'];
          return (
            <View key={seg.key} style={st.legendRow}>
              <View style={[st.dot, { backgroundColor: cfg.color }]} />
              <Text style={st.legendLabel}>{cfg.label}</Text>
              <View style={{ flex: 1 }} />
              <Text style={st.legendCount}>{seg.count}</Text>
              <Text style={st.legendPct}> {Math.round(seg.pct * 100)}%</Text>
            </View>
          );
        })}
        {segments.length === 0 && <Text style={st.empty}>No tasks yet</Text>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  centerNum: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
  centerSub: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  legendCount: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  legendPct: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  empty: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
});
