/**
 * FloatingTabBar — Apple iOS Native Style
 *
 * Design principles (mirrors Apple's iOS tab bar exactly):
 * ─ No background pill behind the active icon
 * ─ Active state = icon + label color turns blue (#155DFC)
 * ─ Two icon layers stacked (gray outline + blue filled) — opacity cross-fade
 *   so the transition is buttery smooth with useNativeDriver: true
 * ─ Press animation: icon scales DOWN (0.82) instantly, springs back on release
 * ─ Label scales slightly on active (1.0 → 1.05) for subtle emphasis
 * ─ Frosted glass pill with proper BlurView on iOS, rgba on Android
 * ─ Icons: SF-Symbol inspired, bold stroke (2.2 inactive, solid fill when active)
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Animated, useWindowDimensions,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { name: 'index',   label: 'Home'    },
  { name: 'spaces',  label: 'Spaces'  },
  { name: 'inbox',   label: 'Inbox'   },
  { name: 'profile', label: 'Profile' },
] as const;

// ─── Icons: two variants per tab ──────────────────────────────────────────────
// Each icon has an OUTLINE (inactive) and a FILLED (active) version.
// We render both stacked, then cross-fade opacity.

const ICON_SIZE = 24;
const INACTIVE_COLOR = '#8E8E93';   // iOS system gray
const ACTIVE_COLOR   = '#155DFC';   // brand blue

// Home
function HomeOutline() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={INACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <Path d="M9 21V12h6v9" />
    </Svg>
  );
}
function HomeFilled() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={ACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"
        fill={ACTIVE_COLOR} fillOpacity={0.12} />
      <Path d="M9 21V12h6v9" />
    </Svg>
  );
}

// Spaces
function SpacesOutline() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={INACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3}  y={3}  width={8} height={8} rx={2.5} />
      <Rect x={13} y={3}  width={8} height={8} rx={2.5} />
      <Rect x={3}  y={13} width={8} height={8} rx={2.5} />
      <Rect x={13} y={13} width={8} height={8} rx={2.5} />
    </Svg>
  );
}
function SpacesFilled() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={ACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3}  y={3}  width={8} height={8} rx={2.5} fill={ACTIVE_COLOR} fillOpacity={0.15} />
      <Rect x={13} y={3}  width={8} height={8} rx={2.5} fill={ACTIVE_COLOR} fillOpacity={0.15} />
      <Rect x={3}  y={13} width={8} height={8} rx={2.5} />
      <Rect x={13} y={13} width={8} height={8} rx={2.5} />
    </Svg>
  );
}

// Inbox
function InboxOutline() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={INACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M2 13h5l2 3h6l2-3h5" />
    </Svg>
  );
}
function InboxFilled() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={ACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        fill={ACTIVE_COLOR} fillOpacity={0.12} />
      <Path d="M2 13h5l2 3h6l2-3h5" />
    </Svg>
  );
}

// Profile
function ProfileOutline() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={INACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  );
}
function ProfileFilled() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke={ACTIVE_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={4} fill={ACTIVE_COLOR} fillOpacity={0.14} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  );
}

const OUTLINE_ICONS = {
  index:   HomeOutline,
  spaces:  SpacesOutline,
  inbox:   InboxOutline,
  profile: ProfileOutline,
};

const FILLED_ICONS = {
  index:   HomeFilled,
  spaces:  SpacesFilled,
  inbox:   InboxFilled,
  profile: ProfileFilled,
};

// ─── TabButton ─────────────────────────────────────────────────────────────────

function TabButton({
  tab,
  active,
  onPress,
  badge,
}: {
  tab: typeof TABS[number];
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  // Cross-fade between outline and filled icon
  const crossfade = useRef(new Animated.Value(active ? 1 : 0)).current;
  // Scale for press-down feedback
  const pressScale = useRef(new Animated.Value(1)).current;
  // Label scale: slightly larger when active
  const labelScale = useRef(new Animated.Value(active ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(crossfade, {
        toValue: active ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(labelScale, {
        toValue: active ? 1 : 0.92,
        useNativeDriver: true,
        tension: 240,
        friction: 20,
      }),
    ]).start();
  }, [active, crossfade, labelScale]);

  const onPressIn = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 0.82,          // shrinks the icon on touch — Apple-style
      useNativeDriver: true,
      tension: 500,
      friction: 12,
    }).start();
  }, [pressScale]);

  const onPressOut = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 240,
      friction: 16,
    }).start();
  }, [pressScale]);

  const OutlineIcon = OUTLINE_ICONS[tab.name];
  const FilledIcon  = FILLED_ICONS[tab.name];

  return (
    <TouchableOpacity
      style={styles.tabButton}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityLabel={tab.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale: pressScale }] }]}>

        {/* Icon cross-fade stack */}
        <View style={styles.iconWrap}>
          {/* Outline (inactive) */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconLayer, { opacity: Animated.subtract(1, crossfade) }]}>
            <OutlineIcon />
          </Animated.View>
          {/* Filled (active) — fades in on top */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconLayer, { opacity: crossfade }]}>
            <FilledIcon />
          </Animated.View>

          {/* Unread badge */}
          {!!badge && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>

        {/* Label — cross-fades color via two stacked Text nodes */}
        <View style={styles.labelWrap}>
          <Animated.Text numberOfLines={1} style={[styles.tabLabel, { opacity: Animated.subtract(1, crossfade), transform: [{ scale: labelScale }] }]}>
            {tab.label}
          </Animated.Text>
          <Animated.Text numberOfLines={1} style={[styles.tabLabel, styles.tabLabelActive, { opacity: crossfade, transform: [{ scale: labelScale }] }]}>
            {tab.label}
          </Animated.Text>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── FloatingTabBar ────────────────────────────────────────────────────────────

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const sideInset = screenWidth < 360 ? 12 : 16;
  const barWidth = Math.max(0, screenWidth - sideInset * 2);

  const renderTabs = () =>
    TABS.map((tab) => {
      const route = state.routes.find(r => r.name === tab.name);
      if (!route) return null;
      const isFocused = state.index === state.routes.indexOf(route);

      return (
        <TabButton
          key={tab.name}
          tab={tab}
          active={isFocused}
          onPress={() => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }}
        />
      );
    });

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Background dark gradient shade from bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.12)']}
        pointerEvents="none"
        style={styles.gradientBg}
      />

      {Platform.OS === 'ios' ? (
        // iOS: real frosted glass via BlurView
        <BlurView intensity={85} tint="light" style={[styles.pill, { width: barWidth }]}>
          {/* Extra white overlay for luminosity */}
          <View style={styles.iosOverlay} />
          <View style={styles.tabRow}>{renderTabs()}</View>
        </BlurView>
      ) : (
        // Android: high-opacity white + elevation
        <View style={[styles.pill, styles.androidGlass, { width: barWidth }]}>
          <View style={styles.tabRow}>{renderTabs()}</View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 60, // Tall padding allows the gradient to spread highly
    pointerEvents: 'box-none',
  },

  gradientBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0, // Stretches to fill the 60px padding + pill + inset
  },

  // Floating pill — clean Apple-like proportions
  pill: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
      },
    }),
  },

  // Subtle white sheen for the glass look on iOS
  iosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  // Android fallback
  androidGlass: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    elevation: 20,
    shadowColor: '#64748B',
  },

  // Tab row — even, centered
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 64,
  },

  // Each tab takes equal space
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },

  // Inner content — icon + label, perfectly centered, no extra padding
  tabInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  // Fixed square for icon — ensures perfect centering regardless of SVG
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Both icon layers fill the same space
  iconLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notification dot
  badge: {
    position: 'absolute',
    top: -3,
    right: -7,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FF3B30',   // iOS red
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 11,
  },

  // Label container — stacks two Texts for color cross-fade
  labelWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 14,
    width: '100%',
    maxWidth: 60, // keeps the current label proportions on wider screens
  },

  tabLabel: {
    position: 'absolute',
    fontSize: 10.5,
    fontWeight: '500',
    color: INACTIVE_COLOR,
    letterSpacing: 0,
    textAlign: 'center',
    width: '100%',
  },
  tabLabelActive: {
    color: ACTIVE_COLOR,
    fontWeight: '600',
  },
});
