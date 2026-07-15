import React, { type ComponentProps, useRef, useEffect, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Animated, Easing, Pressable, useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { T } from '../../constants/tokens';

const INACTIVE_W = 48;
const ACTIVE_W = 132;
const MIN_INACTIVE_W = 32;
const MIN_ACTIVE_W = 92;
const ROW_H = 48;
const TAB_GAP = 8;
const ICON_SZ = 22;
const TOP_NAV_SIDE_PADDING = 12;
const MORE_GRID_COLUMNS = 3;
const ROW_ANIM_MS = 240;
const DROPDOWN_ANIM_MS = 260;
const EXITING_MORE_CLEAR_MS = ROW_ANIM_MS + 80;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLabelWidth(label: string) {
  return Math.ceil(label.length * 9.2);
}

function getActiveTabWidth(label: string) {
  return ICON_SZ + 18 + Math.max(getLabelWidth(label), 44);
}

export type ProjectTab = 'summary' | 'backlog' | 'board' | 'timeline' | 'chat' | 'more' | string;
export type MoreTab =
  | 'timeline' | 'calendar' | 'burndown' | 'milestone'
  | 'members' | 'pages' | 'docs' | 'list' | 'report';

type PremiumIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: { key: ProjectTab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'board', label: 'Board' },
  { key: 'chat', label: 'Chat' },
  { key: 'more', label: 'More' },
];

const MAIN_TABS = TABS.filter(tab => tab.key !== 'more');
const MORE_TAB = TABS.find(tab => tab.key === 'more')!;

type MoreItem = {
  key: MoreTab;
  label: string;
  icon: PremiumIconName;
  tint: string;
  tintSoft: string;
};

type DisplayTab = {
  id: string;
  tab: typeof TABS[number];
  moreItem?: MoreItem;
  hidden?: boolean;
};

const MORE_ITEMS: MoreItem[] = [
  { key: 'timeline', label: 'Timeline', icon: 'timeline-clock-outline', tint: '#155DFC', tintSoft: '#E8F0FF' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-month-outline', tint: '#0F9F6E', tintSoft: '#E7F8F1' },
  { key: 'burndown', label: 'Burndown', icon: 'chart-line-variant', tint: '#E11D48', tintSoft: '#FFF0F4' },
  { key: 'milestone', label: 'Milestone', icon: 'flag-checkered', tint: '#7C3AED', tintSoft: '#F2ECFF' },
  { key: 'members', label: 'Members', icon: 'account-group-outline', tint: '#0891B2', tintSoft: '#E6F7FB' },
  { key: 'pages', label: 'Pages', icon: 'book-open-page-variant-outline', tint: '#D97706', tintSoft: '#FFF6E8' },
  { key: 'docs', label: 'Docs', icon: 'file-document-edit-outline', tint: '#4F46E5', tintSoft: '#EEF0FF' },
  { key: 'list', label: 'List', icon: 'format-list-checks', tint: '#475569', tintSoft: '#F1F5F9' },
  { key: 'report', label: 'Report', icon: 'file-chart-outline', tint: '#DB2777', tintSoft: '#FDF2F8' },
];

// ─── Icons ───────────────────────────────────────────────────────────────────
function TabIcon({
  name,
  active,
  moreItem,
}: {
  name: ProjectTab;
  active: boolean;
  moreItem?: MoreItem;
}) {
  const c = active ? T.primary : T.textSecondary;
  const sw = 2.2;
  const fa = active ? T.primary + '1A' : T.textSecondary + '25';
  const p = {
    width: ICON_SZ, height: ICON_SZ, viewBox: '0 0 24 24', fill: 'none',
    stroke: c, strokeWidth: sw,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };

  if (name === 'summary') return (
    <Svg {...p}>
      <Rect x={3} y={3} width={8} height={8} rx={2.5} fill={fa} />
      <Rect x={13} y={3} width={8} height={8} rx={2.5} fill={fa} />
      <Rect x={3} y={13} width={8} height={8} rx={2.5} />
      <Rect x={13} y={13} width={8} height={8} rx={2.5} />
    </Svg>
  );
  if (name === 'backlog') return (
    <Svg {...p}>
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <Rect x={9} y={3} width={6} height={4} rx={1} fill={fa} />
      <Line x1={9} y1={12} x2={15} y2={12} />
      <Line x1={9} y1={16} x2={13} y2={16} />
    </Svg>
  );
  if (name === 'board') return (
    <Svg {...p}>
      <Rect x={3} y={3} width={5} height={18} rx={2} fill={fa} />
      <Rect x={10} y={3} width={5} height={12} rx={2} fill={fa} />
      <Rect x={17} y={3} width={4} height={15} rx={2} />
    </Svg>
  );
  if (name === 'timeline') return (
    <Svg {...p}>
      <Path d="M4 19V5" />
      <Path d="M8 19V9" />
      <Path d="M12 19V7" />
      <Path d="M16 19V11" />
      <Path d="M20 19V4" />
    </Svg>
  );
  if (name === 'chat') return (
    <Svg {...p}>
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill={fa} />
    </Svg>
  );
  if (moreItem) {
    return (
      <MaterialCommunityIcons
        name={moreItem.icon}
        size={ICON_SZ}
        color={active ? moreItem.tint : T.textSecondary}
      />
    );
  }

  return (
    <Svg {...p}>
      <Circle cx={5} cy={12} r={1.8} fill={c} stroke="none" />
      <Circle cx={12} cy={12} r={1.8} fill={c} stroke="none" />
      <Circle cx={19} cy={12} r={1.8} fill={c} stroke="none" />
    </Svg>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({
  tab, widthAnim, gapAnim, inactiveWidth, activeWidth, active, hidden, onPress, moreItem,
}: {
  tab: typeof TABS[number];
  widthAnim: Animated.Value;
  gapAnim: Animated.Value;
  inactiveWidth: number;
  activeWidth: number;
  active: boolean;
  hidden?: boolean;
  onPress: () => void;
  moreItem?: MoreItem;
}) {
  const press = useRef(new Animated.Value(1)).current;
  const label = moreItem?.label ?? tab.label;
  const labelTargetWidth = useMemo(
    () => Math.min(Math.max(getLabelWidth(label), 44), activeWidth - ICON_SZ - 18),
    [activeWidth, label]
  );

  // Fade background early so it feels like a solid pill
  const activeBgOp = widthAnim.interpolate({
    inputRange: [inactiveWidth, inactiveWidth + 24, activeWidth],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });

  // Fade text/icon smoothly over the entire expansion
  const activeOp = widthAnim.interpolate({
    inputRange: [inactiveWidth, activeWidth],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Animate the label container width so content stays perfectly centered
  const labelWidth = widthAnim.interpolate({
    inputRange: [inactiveWidth, activeWidth],
    outputRange: [0, labelTargetWidth],
    extrapolate: 'clamp',
  });

  // Animate the gap so when inactive, the icon is perfectly alone in the center
  const labelMargin = widthAnim.interpolate({
    inputRange: [inactiveWidth, activeWidth],
    outputRange: [0, 8],
    extrapolate: 'clamp',
  });

  // Slide text leftwards when shrinking so it tucks behind the icon and escapes the collapsing right edge
  const textX = widthAnim.interpolate({
    inputRange: [inactiveWidth, activeWidth],
    outputRange: [-20, 0],
    extrapolate: 'clamp',
  });
  const itemOpacity = widthAnim.interpolate({
    inputRange: [0, Math.max(1, inactiveWidth)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const pressIn = useCallback(() =>
    Animated.spring(press, { toValue: 0.9, tension: 700, friction: 14, useNativeDriver: false }).start(), [press]);
  const pressOut = useCallback(() =>
    Animated.spring(press, { toValue: 1, tension: 300, friction: 18, useNativeDriver: false }).start(), [press]);

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[ns.tabBtn, { width: widthAnim, marginRight: gapAnim, opacity: itemOpacity, transform: [{ scale: press }] }]}
    >
      {/* Subtle glass background for inactive tabs */}
      <View style={ns.inactiveBg} />

      {/* Solid white background for active tab */}
      <Animated.View style={[ns.activeBg, { opacity: activeBgOp }]} />

      {/* ContentWrapper clips the text when shrinking to a circle */}
      <View style={ns.contentWrapper}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          activeOpacity={1}
          style={ns.touchable}
          accessibilityLabel={label}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
        >
          <View style={ns.iconBox}>
            {/* Crossfade icons */}
            <Animated.View style={[StyleSheet.absoluteFill, ns.iconLayer, { opacity: Animated.subtract(1, activeOp) }]}>
              <TabIcon name={tab.key} active={false} moreItem={moreItem} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, ns.iconLayer, { opacity: activeOp }]}>
              <TabIcon name={tab.key} active={true} moreItem={moreItem} />
            </Animated.View>

          </View>

          <Animated.View style={[ns.labelBox, { opacity: activeOp, width: labelWidth, marginLeft: labelMargin }]}>
            <Animated.Text numberOfLines={1} style={[ns.label, { transform: [{ translateX: textX }] }]}>
              {label}
            </Animated.Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// Removed MorePopup completely. Dropping down from TopNav inline.

function PremiumMoreIcon({ item, selected }: { item: MoreItem; selected: boolean }) {
  const iconColors = selected
    ? [item.tint, T.primary] as const
    : [item.tint + '22', item.tintSoft] as const;

  return (
    <View style={[ds.iconShell, selected && ds.iconShellSel]}>
      <LinearGradient
        colors={iconColors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ds.iconGradient}
      >
        <View style={[ds.iconAura, { backgroundColor: selected ? 'rgba(255,255,255,0.2)' : item.tintSoft }]} />
        <MaterialCommunityIcons
          name={item.icon}
          size={25}
          color={selected ? '#FFFFFF' : item.tint}
        />
      </LinearGradient>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export interface ProjectTopNavProps {
  projectName?: string;
  activeTab: ProjectTab;
  activeMoreTab?: MoreTab;
  onTabChange: (tab: ProjectTab) => void;
  onMoreTabChange?: (tab?: MoreTab) => void;
  onSettingsPress?: () => void;
  onGithubPress?: () => void;
}

export default function ProjectTopNav({
  projectName,
  activeTab, activeMoreTab, onTabChange, onMoreTabChange, onSettingsPress, onGithubPress,
}: ProjectTopNavProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [moreOpen, setMoreOpen] = useState(false);
  const activeMoreItem = useMemo(
    () => MORE_ITEMS.find(item => item.key === activeMoreTab),
    [activeMoreTab]
  );
  const previousMoreItemRef = useRef<MoreItem | undefined>(activeMoreItem);
  const [exitingMoreItem, setExitingMoreItem] = useState<MoreItem | undefined>();

  useLayoutEffect(() => {
    if (activeMoreItem) {
      previousMoreItemRef.current = activeMoreItem;
      setExitingMoreItem(undefined);
      return undefined;
    }

    if (!previousMoreItemRef.current) return undefined;

    setExitingMoreItem(previousMoreItemRef.current);
    previousMoreItemRef.current = undefined;

    const timeout = setTimeout(() => setExitingMoreItem(undefined), EXITING_MORE_CLEAR_MS);
    return () => clearTimeout(timeout);
  }, [activeMoreItem]);

  const selectedMoreItem = activeMoreItem ?? exitingMoreItem;
  const displayTabs = useMemo<DisplayTab[]>(() => {
    const tabs: DisplayTab[] = MAIN_TABS.map(tab => ({ id: tab.key, tab }));

    if (selectedMoreItem) {
      tabs.push({
        id: `more-${selectedMoreItem.key}`,
        tab: { key: 'more', label: selectedMoreItem.label },
        moreItem: selectedMoreItem,
        hidden: moreOpen || !!exitingMoreItem,
      });
    }

    tabs.push({ id: 'more-menu', tab: MORE_TAB });
    return tabs;
  }, [exitingMoreItem, moreOpen, selectedMoreItem]);

  const activeIdx = useMemo(() => {
    const idx = displayTabs.findIndex(item => (
      activeMoreItem && !moreOpen
        ? item.moreItem?.key === activeMoreItem.key
        : item.id === 'more-menu' && activeTab === 'more'
          ? true
          : !item.moreItem && item.tab.key === activeTab
    ));

    return idx >= 0 ? idx : 0;
  }, [activeMoreItem, activeTab, displayTabs, moreOpen]);
  const tabMetrics = useMemo(() => {
    const availableWidth = Math.max(0, screenWidth - TOP_NAV_SIDE_PADDING * 2);
    const visibleTabCount = displayTabs.filter(item => !item.hidden).length;
    const totalGap = TAB_GAP * (visibleTabCount - 1);
    const activeItem = displayTabs[activeIdx];
    const activeLabel = activeItem?.moreItem?.label ?? activeItem?.tab.label ?? '';
    const dynamicActiveWidth = Math.max(ACTIVE_W, getActiveTabWidth(activeLabel));
    const maxActiveWidth = Math.max(
      MIN_ACTIVE_W,
      availableWidth - totalGap - MIN_INACTIVE_W * (visibleTabCount - 1)
    );
    const activeWidth = clamp(dynamicActiveWidth, MIN_ACTIVE_W, maxActiveWidth);
    const inactiveWidth = clamp(
      (availableWidth - totalGap - activeWidth) / (visibleTabCount - 1),
      MIN_INACTIVE_W,
      INACTIVE_W
    );

    return { activeWidth, inactiveWidth };
  }, [activeIdx, displayTabs, screenWidth]);

  const moreGridMetrics = useMemo(() => {
    const horizontalPadding = screenWidth < 360 ? 12 : 16;
    const gap = screenWidth < 360 ? 10 : 12;
    const gridWidth = Math.max(0, screenWidth - horizontalPadding * 2);
    const cellWidth = Math.floor((gridWidth - gap * (MORE_GRID_COLUMNS - 1)) / MORE_GRID_COLUMNS);
    const cellHeight = clamp(cellWidth * 0.78, 78, 90);
    const rows = Math.ceil(MORE_ITEMS.length / MORE_GRID_COLUMNS);
    const dropdownHeight = 16 + 30 + cellHeight * rows + gap * (rows - 1) + 32;

    return { horizontalPadding, gap, cellWidth, cellHeight, dropdownHeight };
  }, [screenWidth]);

  const tabWidths = useRef(
    Array.from({ length: MAIN_TABS.length + 2 }, (_, i) =>
      new Animated.Value(i === activeIdx ? tabMetrics.activeWidth : tabMetrics.inactiveWidth)
    )
  ).current;
  const tabGaps = useRef(
    Array.from({ length: MAIN_TABS.length + 2 }, (_, i) =>
      new Animated.Value(i < MAIN_TABS.length ? TAB_GAP : 0)
    )
  ).current;

  useEffect(() => {
    const cfg = {
      duration: ROW_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    };
    const lastVisibleIndex = displayTabs.reduce((last, item, i) => item.hidden ? last : i, -1);

    tabWidths.forEach(anim => anim.stopAnimation());
    tabGaps.forEach(anim => anim.stopAnimation());

    Animated.parallel(
      displayTabs.flatMap((item, i) => [
        Animated.timing(tabWidths[i], {
          toValue: item.hidden ? 0 : i === activeIdx ? tabMetrics.activeWidth : tabMetrics.inactiveWidth,
          ...cfg,
        }),
        Animated.timing(tabGaps[i], {
          toValue: item.hidden || i === lastVisibleIndex ? 0 : TAB_GAP,
          ...cfg,
        }),
      ])
    ).start();
  }, [activeIdx, displayTabs, tabGaps, tabMetrics.activeWidth, tabMetrics.inactiveWidth, tabWidths]);

  const entryY = useRef(new Animated.Value(-80)).current;
  const entryOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(entryY, { toValue: 0, tension: 200, friction: 24, useNativeDriver: true }),
      Animated.timing(entryOp, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [entryOp, entryY]);

  const dropdownHeightAnim = useRef(new Animated.Value(0)).current;
  const dropdownOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (moreOpen) {
      Animated.parallel([
        Animated.timing(dropdownHeightAnim, {
          toValue: moreGridMetrics.dropdownHeight,
          duration: DROPDOWN_ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(dropdownOp, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          delay: 30,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(dropdownHeightAnim, {
          toValue: 0,
          duration: 210,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(dropdownOp, {
          toValue: 0,
          duration: 130,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [dropdownHeightAnim, dropdownOp, moreOpen, moreGridMetrics.dropdownHeight]);

  const handlePress = useCallback((tab: ProjectTab) => {
    if (tab === 'more') {
      const opening = !moreOpen;
      setMoreOpen(opening);
      onTabChange('more');
    } else {
      setMoreOpen(false);
      onTabChange(tab);
    }
  }, [moreOpen, onTabChange]);
  const dropdownTranslateY = dropdownOp.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
    extrapolate: 'clamp',
  });

  return (
    <>
      {/* Animated Frosted Glass Background Overlay */}
      <Pressable
        onPress={() => setMoreOpen(false)}
        pointerEvents={moreOpen ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { zIndex: 90 }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: dropdownOp }]}>
          <BlurView intensity={50} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>

      {/* The Main Top Navigation Bar Expanding Downwards */}
      <Animated.View style={[
        ns.container,
        { paddingTop: insets.top + 8, paddingBottom: 12, transform: [{ translateY: entryY }], opacity: entryOp },
      ]}>
        <BlurView intensity={50} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />

        {/* Large Project Title (Apple iOS / Web Style) */}
        <View style={ns.titleRow}>
          <View style={ns.titleContent}>
            <View style={ns.breadcrumbRow}>
              <Text style={ns.breadcrumbText}>PROJECT</Text>
              <Text style={ns.breadcrumbSlash}>/</Text>
            </View>
            <Text style={ns.titleText} numberOfLines={1}>{projectName || 'Workspace'}</Text>
          </View>

          {(onGithubPress || onSettingsPress) && (
            <View style={ns.actionBtns}>
              {onGithubPress && (
                <TouchableOpacity
                  onPress={onGithubPress}
                  style={ns.iconBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="GitHub"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="github" size={20} color={T.primary} />
                </TouchableOpacity>
              )}
              {onSettingsPress && (
                <TouchableOpacity
                  onPress={onSettingsPress}
                  style={ns.iconBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Project Settings"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="cog-outline" size={20} color={T.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={ns.row}>
          {displayTabs.map((item, idx) => (
            <TabBtn
              key={item.id}
              tab={item.tab}
              widthAnim={tabWidths[idx]}
              gapAnim={tabGaps[idx]}
              inactiveWidth={tabMetrics.inactiveWidth}
              activeWidth={tabMetrics.activeWidth}
              active={idx === activeIdx}
              hidden={item.hidden}
              onPress={() => {
                if (item.moreItem) {
                  onMoreTabChange?.(item.moreItem.key);
                  setMoreOpen(false);
                  return;
                }

                handlePress(item.tab.key);
              }}
              moreItem={item.moreItem}
            />
          ))}
        </View>

        {/* The Inline Full-Width Dropdown Area */}
        <Animated.View style={{ height: dropdownHeightAnim, overflow: 'hidden' }}>
          <Animated.View style={{
            opacity: dropdownOp,
            transform: [{ translateY: dropdownTranslateY }],
            paddingHorizontal: moreGridMetrics.horizontalPadding,
            paddingTop: 16,
            paddingBottom: 32,
          }}>
            <View style={ds.hdr}>
              <View style={ds.hdrAccent} />
              <Text style={ds.hdrTxt}>MORE VIEWS</Text>
            </View>

            <View style={[ds.grid, { gap: moreGridMetrics.gap }]}>
              {MORE_ITEMS.map(item => {
                const isSel = activeMoreTab === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => { onMoreTabChange?.(item.key); setMoreOpen(false); }}
                    activeOpacity={0.7}
                    style={[
                      ds.cell,
                      { width: moreGridMetrics.cellWidth, height: moreGridMetrics.cellHeight },
                      isSel && [
                        ds.cellSel,
                        {
                          backgroundColor: item.tintSoft,
                          borderColor: `${item.tint}66`,
                        },
                      ],
                    ]}
                  >
                    <PremiumMoreIcon item={item} selected={isSel} />
                    <Text style={ds.cellLbl}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ns = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  titleContent: {
    flex: 1,
    marginRight: 10,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    ...Platform.select({
      ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  breadcrumbText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  breadcrumbSlash: {
    fontSize: 10,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '900', // Matches web's black/extrabold style
    color: T.primary, // Web uses blue for mobile
    letterSpacing: -0.8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: ROW_H,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  tabBtn: {
    height: ROW_H,
    borderRadius: ROW_H / 2,
    justifyContent: 'center',
  },
  inactiveBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    borderRadius: ROW_H / 2,
  },
  activeBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.primaryLight,
    borderWidth: 1, borderColor: T.primaryMuted + '55',
    borderRadius: ROW_H / 2,
    ...Platform.select({
      ios: { shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  contentWrapper: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ROW_H / 2,
    overflow: 'hidden',
  },
  touchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: ICON_SZ,
    height: ICON_SZ,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBox: {
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: 14.5,
    fontWeight: '800',
    color: T.primary,
    letterSpacing: 0.2,
  },
});

const ds = StyleSheet.create({
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 16,
    paddingHorizontal: 6,
  },
  hdrAccent: { width: 4, height: 14, borderRadius: 2, backgroundColor: T.primary, opacity: 0.8 },
  hdrTxt:  { fontSize: 11, fontWeight: '800', color: T.textSecondary, letterSpacing: 1.6 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: {
    height: 90,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center', justifyContent: 'center',
    gap: 7,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18 },
      android: { elevation: 0 },
    }),
  },
  cellSel: {
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 2 },
    }),
  },
  iconShell: {
    width: 46,
    height: 46,
    borderRadius: 16,
    padding: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 0 },
    }),
  },
  iconShellSel: {
    borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  iconGradient: {
    flex: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconAura: {
    position: 'absolute',
    right: -9,
    top: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.78,
  },
  cellLbl: {
    fontSize: 11.5,
    fontWeight: '800',
    color: T.textPrimary,
    letterSpacing: 0,
  },
});
