import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import ProjectTopNav, {
  ProjectTab,
  MoreTab,
} from '../../src/components/navigation/ProjectTopNav';
import SummaryScreen  from '../../src/components/summary/SummaryScreen';
import ReportScreen   from '../../src/components/report/ReportScreen';
import { ChatTabContent } from '../../src/components/chat/ChatTabContent';
import ProjectBoardScreen from '../../src/components/board/ProjectBoardScreen';
import ProjectSprintBoardScreen from '../../src/components/board/ProjectSprintBoardScreen';
import MobileBacklogScreen from '../../src/components/backlog/MobileBacklogScreen';
import { useProjectSummary } from '../../src/hooks/useProjectSummary';
import MobilePagesScreen from '../../src/components/pages/MobilePagesScreen';
import MobileDocsScreen from '../../src/components/docs/MobileDocsScreen';
import MobileBurndownScreen from '../../src/components/burndown/MobileBurndownScreen';
import MobileMembersScreen from '../../src/components/members/MobileMembersScreen';
import MobileTimelineScreen from '../../src/components/timeline/MobileTimelineScreen';
import MobileListScreen from '../../src/components/list/MobileListScreen';
import MobileCalendarScreen from '../../src/components/calendar/MobileCalendarScreen';
import MobileMilestoneScreen from '../../src/components/milestone/MobileMilestoneScreen';

/** Height of the nav bar = padding top (8) + title row (56) + tab row (48) + padding bottom (12) */
const NAV_INNER_HEIGHT = 124; // matches ProjectTopNav.tsx exactly

// ─── Placeholder screens (connect later) ──────────────────────────────────────
function PlaceholderScreen({ label }: { label: string }) {
  return (
    <View style={ph.wrap}>
      <Text style={ph.emoji}>🚧</Text>
      <Text style={ph.title}>{label}</Text>
      <Text style={ph.sub}>Coming soon — this page will be connected next.</Text>
    </View>
  );
}

const ph = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emoji: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 },
  sub:   { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40 },
});

// ─── Route ────────────────────────────────────────────────────────────────────
const MAIN_TAB_KEYS: ProjectTab[] = ['summary', 'backlog', 'board', 'chat'];
const MORE_TAB_KEYS: MoreTab[] = ['timeline', 'calendar', 'burndown', 'milestone', 'members', 'pages', 'docs', 'list', 'report'];

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ProjectRoute() {
  const { projectId, projectName, tab, more } = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
    tab?: string;
    more?: string;
  }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [activeTab,     setActiveTab]     = useState<ProjectTab | MoreTab>('summary');
  const [lastMainTab,   setLastMainTab]   = useState<ProjectTab>('summary');
  const [activeMoreTab, setActiveMoreTab] = useState<MoreTab | undefined>();

  useEffect(() => {
    const requestedMore = firstParam(more);
    if (requestedMore && MORE_TAB_KEYS.includes(requestedMore as MoreTab)) {
      setActiveMoreTab(requestedMore as MoreTab);
      setActiveTab(requestedMore as MoreTab);
      return;
    }

    const requestedTab = firstParam(tab);
    if (requestedTab && MAIN_TAB_KEYS.includes(requestedTab as ProjectTab)) {
      setActiveTab(requestedTab as ProjectTab);
      setLastMainTab(requestedTab as ProjectTab);
      setActiveMoreTab(undefined);
    }
  }, [tab, more]);

  /** Total nav bar height so content scrolls below it */
  const navHeight = insets.top + NAV_INNER_HEIGHT;

  const handleTabChange = useCallback((tab: ProjectTab | MoreTab) => {
    setActiveTab(tab);
    // Clear more-tab when switching to a main tab
    if (tab !== 'more' && !MORE_TAB_KEYS.includes(tab as MoreTab)) {
      setLastMainTab(tab as ProjectTab);
      setActiveMoreTab(undefined);
    }
  }, []);

  const handleMoreTabChange = useCallback((tab?: MoreTab) => {
    if (!tab) {
      setActiveMoreTab(undefined);
      return;
    }

    setActiveMoreTab(tab);
    setActiveTab(tab); // Make the new dynamic tab visually active
  }, []);

  const numericId = Number(projectId);
  const paramName = firstParam(projectName);

  const { data } = useProjectSummary(numericId);
  const name = paramName || data?.projectDetails?.name;

  const handleSettingsPress = useCallback(() => {
    router.push({
      pathname: '/project/[projectId]/settings',
      params: { projectId: numericId, projectName: name ?? '' },
    });
  }, [router, numericId, name]);

  const handleGithubPress = useCallback(() => {
    router.push({
      pathname: '/github/[projectId]',
      params: { projectId: numericId, projectName: name ?? '' },
    });
  }, [router, numericId, name]);

  // ── Content area ────────────────────────────────────────────────────────────
  const renderContent = () => {
    // If a "More" sub-tab is active, render it
    if (activeMoreTab) {
      if (activeMoreTab === 'report') {
        return (
          <ReportScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      }
      if (activeMoreTab === 'pages') {
        return (
          <MobilePagesScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight}
          />
        );
      }
      if (activeMoreTab === 'docs') {
        return (
          <MobileDocsScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight}
          />
        );
      }
      if (activeMoreTab === 'burndown') {
        return (
          <MobileBurndownScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      }
      if (activeMoreTab === 'members') {
        return (
          <MobileMembersScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      }
      if (activeMoreTab === 'timeline') {
        return (
          <MobileTimelineScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      }
      if (activeMoreTab === 'calendar') {
        return (
          <MobileCalendarScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      }
      if (activeMoreTab === 'milestone') {
        return (
          <MobileMilestoneScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      }
      if (activeMoreTab === 'list') {
        return (
          <MobileListScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      }
      const labels: Record<MoreTab, string> = {
        timeline:  'Timeline',
        calendar:  'Calendar',
        burndown:  'Burndown Chart',
        milestone: 'Milestones',
        members:   'Members',
        pages:     'Pages',
        docs:      'Docs',
        list:      'List',
        report:    'Report',
      };
      return (
        <View style={{ flex: 1, paddingTop: navHeight }}>
          <PlaceholderScreen label={labels[activeMoreTab]} />
        </View>
      );
    }

    // Keep rendering the background tab if the 'More' dropdown is open
    const tabToRender = activeTab === 'more' ? lastMainTab : activeTab;

    switch (tabToRender) {
      case 'summary':
        return (
          <SummaryScreen
            projectId={numericId}
            projectName={name}
            hideHeader
            topOffset={navHeight + 16} // Provide 16px of visual gap below the top nav
            onBack={() => router.back()}
          />
        );
      case 'backlog':
        return (
          <MobileBacklogScreen
            projectId={numericId}
            projectName={name}
            isAgile={!!data?.isAgile}
            topOffset={navHeight + 16}
          />
        );
      case 'board':
        return data?.isAgile ? (
          <ProjectSprintBoardScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        ) : (
          <ProjectBoardScreen
            projectId={numericId}
            projectName={name}
            topOffset={navHeight + 16}
          />
        );
      case 'chat':
        return (
          <ChatTabContent projectId={String(numericId)} navHeight={navHeight} />
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <StatusBar style="dark" />

      {/* Content renders behind / below the nav */}
      {renderContent()}

      {/* Nav bar floats on top — absolutely positioned */}
      <ProjectTopNav
        activeTab={activeMoreTab ? 'more' : activeTab as ProjectTab}
        activeMoreTab={activeMoreTab}
        onTabChange={handleTabChange}
        onMoreTabChange={handleMoreTabChange}
        projectName={name}
        onSettingsPress={handleSettingsPress}
        onGithubPress={handleGithubPress}
      />
    </View>
  );
}
