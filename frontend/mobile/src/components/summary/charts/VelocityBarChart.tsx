/**
 * VelocityBarChart — Light theme, animated bar chart.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import type { Task, Sprint } from '../../../hooks/useProjectSummary';

const { width: SW } = Dimensions.get('window');
const W = SW - 72, H = 140;
const P = { t: 10, b: 28, l: 28, r: 6 };
const AnimRect = Animated.createAnimatedComponent(Rect);

export function VelocityBarChart({ tasks, sprints }: { tasks: Task[]; sprints: Sprint[] }) {
  const data = useMemo(() => {
    const done = [...sprints].filter(s => s.status === 'COMPLETED').slice(-5);
    return done.map(sp => ({
      name: sp.name?.replace(/sprint\s*/i, 'S') || `S${sp.id}`,
      pts: tasks.filter(t => t.sprintId === sp.id && t.status === 'DONE').reduce((a, t) => a + (t.storyPoint || 0), 0),
    }));
  }, [tasks, sprints]);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 1100, useNativeDriver: false }).start();
  }, [anim, data.length]);

  if (data.length === 0) return (
    <View style={st.empty}><Text style={st.emptyIcon}>⚡</Text><Text style={st.emptyText}>Complete sprints to see velocity</Text></View>
  );

  const pw = W - P.l - P.r, ph = H - P.t - P.b;
  const max = Math.max(...data.map(d => d.pts), 1);
  const bw = Math.min((pw / data.length) * 0.5, 36);
  const gap = pw / data.length;
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]));
  const ty = (v: number) => P.t + ph - (v / max) * ph;

  return (
    <View style={{ width: '100%' }}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          <Defs>
            <SvgGrad id="bar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#00875A" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#34D399" stopOpacity="0.6" />
            </SvgGrad>
          </Defs>
          {ticks.map(v => <Path key={`grid-${v}`} d={`M ${P.l} ${ty(v)} L ${P.l + pw} ${ty(v)}`} stroke="#F1F5F9" strokeWidth={1} />)}
          {data.map((d, i) => {
            const bh = anim.interpolate({ inputRange: [0, 1], outputRange: [0, (d.pts / max) * ph] });
            const by = anim.interpolate({ inputRange: [0, 1], outputRange: [P.t + ph, ty(d.pts)] });
            const cx = P.l + gap * i + gap / 2 - bw / 2;
            return <AnimRect key={`${d.name}-${i}`} x={cx} y={by} width={bw} height={bh} rx={6} fill="url(#bar)" />;
          })}
        </Svg>
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {ticks.map(v => (
            <Text key={`tick-${v}`} style={[st.axisY, { top: ty(v) - 7, left: 0, width: P.l - 3 }]}>{v}</Text>
          ))}
          {data.map((d, i) => {
            const cx = P.l + gap * i + gap / 2;
            const bTop = ty(d.pts);
            return (
              <React.Fragment key={`bar-label-${i}`}>
                <Text style={[st.axisX, { top: H - P.b + 5, left: cx - 16, width: 32 }]}>{d.name}</Text>
                {d.pts > 0 && <Text style={[st.valLbl, { top: bTop - 15, left: cx - 14, width: 28 }]}>{d.pts}</Text>}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  axisY: { position: 'absolute', fontSize: 9, fontWeight: '600', color: '#94A3B8', textAlign: 'right' },
  axisX: { position: 'absolute', fontSize: 9, fontWeight: '500', color: '#94A3B8', textAlign: 'center' },
  valLbl: { position: 'absolute', fontSize: 10, fontWeight: '800', color: '#00875A', textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyIcon: { fontSize: 28 },
  emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
});
