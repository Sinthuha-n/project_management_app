import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, TextInput, Modal, Animated, SectionList,
  Platform, Linking, LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import {
  getGitHubToken, saveGitHubToken, clearGitHubToken,
  getProjectGitHubRepo, setProjectGitHubRepo, clearProjectGitHubRepo,
  fetchGitHubUser, fetchRepositoriesWithToken, fetchPullRequests, fetchCommits, fetchIssues,
  fetchGitHubOAuthConfig,
  exchangeCodeForToken,
  fetchProjectPullRequests, fetchProjectCommits, fetchProjectIssues, syncProjectGitHub,
  type ProjectGitHubConnection, type GitHubUser,
  type GitHubPullRequest, type GitHubCommit, type GitHubIssue, type GitHubRepository,
} from '../../src/services/githubMobileService';

const DEFAULT_REDIRECT_URI = 'planora://github-callback';
type ActiveTab = 'prs' | 'commits' | 'issues';
type IssueFilter = 'open' | 'closed' | 'all';
type NotificationType = 'pull-request' | 'issue' | 'security' | 'release';

type GitHubNotificationItem = {
  id: string;
  repoFullName: string;
  type: NotificationType;
  title: string;
  reason: string;
  timestamp: string;
  unread: boolean;
};

type GitHubNotificationGroup = {
  repoFullName: string;
  unreadCount: number;
  items: GitHubNotificationItem[];
};

const MOCK_ISSUES: GitHubIssue[] = [
  {
    id: 9101,
    number: 1842,
    title: 'Glass shell overlaps the bottom tab bar on shorter devices',
    state: 'open',
    labels: [
      { id: 1, name: 'bug', color: 'ef4444' },
      { id: 2, name: 'mobile', color: '38bdf8' },
    ],
    html_url: 'https://github.com/planora/mobile/issues/1842',
    updated_at: '2026-05-27T17:15:00.000Z',
    user: { login: 'samirh', avatar_url: 'https://avatars.githubusercontent.com/u/9919?v=4' },
    comments: 8,
  },
  {
    id: 9102,
    number: 1848,
    title: 'Notification badges should stay visible over blur layers',
    state: 'open',
    labels: [
      { id: 3, name: 'enhancement', color: '3b82f6' },
      { id: 4, name: 'ui', color: 'a855f7' },
    ],
    html_url: 'https://github.com/planora/mobile/issues/1848',
    updated_at: '2026-05-28T06:25:00.000Z',
    user: { login: 'ninao', avatar_url: 'https://avatars.githubusercontent.com/u/15590466?v=4' },
    comments: 3,
  },
  {
    id: 9103,
    number: 1799,
    title: 'Refine repository picker spacing for compact phones',
    state: 'closed',
    labels: [
      { id: 5, name: 'resolved', color: '94a3b8' },
      { id: 6, name: 'layout', color: '14b8a6' },
    ],
    html_url: 'https://github.com/planora/mobile/issues/1799',
    updated_at: '2026-05-23T14:45:00.000Z',
    user: { login: 'luke', avatar_url: 'https://avatars.githubusercontent.com/u/1000?v=4' },
    comments: 1,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function prStatusInfo(pr: GitHubPullRequest) {
  if (pr.draft) return { label: 'Draft', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.25)' };
  if (pr.merged_at) return { label: 'Merged', color: '#C084FC', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)' };
  if (pr.state === 'closed') return { label: 'Closed', color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' };
  return { label: 'Open', color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' };
}

function issueStatusInfo(issue: GitHubIssue) {
  if (issue.state === 'open') {
    return { label: 'Open', color: '#3fb950', bg: 'rgba(63,185,80,0.18)', border: 'rgba(63,185,80,0.34)' };
  }
  return { label: 'Closed', color: '#94A3B8', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.22)' };
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'GH';
}

function buildNotificationGroups(repoFullName: string): GitHubNotificationGroup[] {
  return [
    {
      repoFullName,
      unreadCount: 2,
      items: [
        {
          id: `${repoFullName}-1`,
          repoFullName,
          type: 'issue',
          title: 'Glass cards for issue rows need a stronger blur edge on dark mode',
          reason: 'mentioned',
          timestamp: '12m ago',
          unread: true,
        },
        {
          id: `${repoFullName}-2`,
          repoFullName,
          type: 'pull-request',
          title: 'Review requested for mobile issue shell polish',
          reason: 'review requested',
          timestamp: '2h ago',
          unread: false,
        },
        {
          id: `${repoFullName}-3`,
          repoFullName,
          type: 'release',
          title: 'v1.8.0 is ready to publish to the beta channel',
          reason: 'subscribed',
          timestamp: '5h ago',
          unread: true,
        },
      ],
    },
    {
      repoFullName: 'vercel/next.js',
      unreadCount: 1,
      items: [
        {
          id: 'vercel-next-1',
          repoFullName: 'vercel/next.js',
          type: 'security',
          title: 'A dependency update is waiting for triage in the app router',
          reason: 'security alert',
          timestamp: '1d ago',
          unread: true,
        },
        {
          id: 'vercel-next-2',
          repoFullName: 'vercel/next.js',
          type: 'issue',
          title: 'Layout shift on iPhone 15 Pro Max in nested scroll views',
          reason: 'subscribed',
          timestamp: '4d ago',
          unread: false,
        },
      ],
    },
  ];
}

// ── Glass Card ────────────────────────────────────────────────────────────────
function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[gc.wrap, style]}>
      <BlurView intensity={16} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={gc.inner}>{children}</View>
    </View>
  );
}
const gc = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12 },
      android: { elevation: 5 },
    }),
  },
  inner: { padding: 14 },
});

// ── PR Card ───────────────────────────────────────────────────────────────────
function PRCard({ pr }: { pr: GitHubPullRequest }) {
  const st = prStatusInfo(pr);
  return (
    <TouchableOpacity onPress={() => Linking.openURL(pr.html_url)} activeOpacity={0.8}>
      <GlassCard>
        <View style={s.rowHead}>
          <View style={[s.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <View style={[s.dot, { backgroundColor: st.color }]} />
            <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
          <Text style={s.meta}>#{pr.number}</Text>
          <Text style={[s.meta, { marginLeft: 'auto' }]}>{timeAgo(pr.updated_at)}</Text>
        </View>
        <Text style={s.cardTitle} numberOfLines={2}>{pr.title}</Text>
        <View style={s.branchRow}>
          <MaterialCommunityIcons name="source-branch" size={11} color="#475569" />
          <Text style={s.branchText}>{pr.head.ref}</Text>
          <Text style={s.arrow}>→</Text>
          <Text style={s.branchText}>{pr.base.ref}</Text>
        </View>
        <View style={s.authorRow}>
          {pr.user?.avatar_url
            ? <Image source={{ uri: pr.user.avatar_url }} style={s.avatar} contentFit="cover" />
            : null}
          <Text style={s.authorText}>@{pr.user?.login}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

// ── Commit Card ───────────────────────────────────────────────────────────────
function CommitCard({ commit }: { commit: GitHubCommit }) {
  const firstLine = commit.commit.message.split('\n')[0];
  const authorName = commit.author?.login ?? commit.commit.author.name;
  return (
    <TouchableOpacity onPress={() => Linking.openURL(commit.html_url)} activeOpacity={0.8}>
      <GlassCard>
        <View style={s.rowHead}>
          <View style={s.shaChip}>
            <MaterialCommunityIcons name="source-commit" size={10} color="#64748B" />
            <Text style={s.shaText}>{commit.sha.slice(0, 7)}</Text>
          </View>
          <Text style={[s.meta, { marginLeft: 'auto' }]}>{timeAgo(commit.commit.author.date)}</Text>
        </View>
        <Text style={s.cardTitle} numberOfLines={2}>{firstLine}</Text>
        <View style={s.authorRow}>
          {commit.author?.avatar_url
            ? <Image source={{ uri: commit.author.avatar_url }} style={s.avatar} contentFit="cover" />
            : null}
          <Text style={s.authorText}>@{authorName}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

// ── Issue Card ────────────────────────────────────────────────────────────────
function IssueCard({ issue }: { issue: GitHubIssue }) {
  const open = issue.state === 'open';
  return (
    <TouchableOpacity onPress={() => Linking.openURL(issue.html_url)} activeOpacity={0.8}>
      <GlassCard>
        <View style={s.rowHead}>
          <View style={[s.badge, open
            ? { backgroundColor: 'rgba(52,211,153,0.12)', borderColor: 'rgba(52,211,153,0.3)' }
            : { backgroundColor: 'rgba(192,132,252,0.12)', borderColor: 'rgba(192,132,252,0.3)' },
          ]}>
            <View style={[s.dot, { backgroundColor: open ? '#34D399' : '#C084FC' }]} />
            <Text style={[s.badgeText, { color: open ? '#34D399' : '#C084FC' }]}>
              {open ? 'Open' : 'Closed'}
            </Text>
          </View>
          <Text style={s.meta}>#{issue.number}</Text>
          <Text style={[s.meta, { marginLeft: 'auto' }]}>{timeAgo(issue.updated_at)}</Text>
        </View>
        <Text style={s.cardTitle} numberOfLines={2}>{issue.title}</Text>
        <View style={s.authorRow}>
          {issue.user?.avatar_url
            ? <Image source={{ uri: issue.user.avatar_url }} style={s.avatar} contentFit="cover" />
            : null}
          <Text style={s.authorText}>@{issue.user?.login}</Text>
          <MaterialCommunityIcons name="comment-outline" size={11} color="#334155" style={{ marginLeft: 10 }} />
          <Text style={s.authorText}>{issue.comments}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[gc.wrap, { height: 100, opacity: 0.35 }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
    </View>
  );
}

// ── Repo Picker Modal ─────────────────────────────────────────────────────────
function RepoPickerModal({
  visible, repos, loading, search, onSearch, onSelect, onClose,
}: {
  visible: boolean;
  repos: GitHubRepository[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (repo: GitHubRepository) => void;
  onClose: () => void;
}) {
  const filtered = repos.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={m.backdrop}>
        <View style={m.sheet}>
          <BlurView intensity={28} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
          <View style={m.content}>
            <View style={m.handle} />
            <View style={m.titleRow}>
              <MaterialCommunityIcons name="github" size={17} color="#fff" />
              <Text style={m.title}>Select a repository</Text>
              <TouchableOpacity onPress={onClose} style={m.closeBtn}>
                <MaterialCommunityIcons name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={m.searchBox}>
              <MaterialCommunityIcons name="magnify" size={15} color="#475569" />
              <TextInput
                style={m.searchInput}
                placeholder="Search repositories…"
                placeholderTextColor="#334155"
                value={search}
                onChangeText={onSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => onSearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={14} color="#334155" />
                </TouchableOpacity>
              )}
            </View>
            {loading ? (
              <View style={m.center}><ActivityIndicator color="#6366F1" /></View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={r => String(r.id)}
                contentContainerStyle={{ paddingBottom: 40 }}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
                renderItem={({ item }) => (
                  <TouchableOpacity style={m.repoRow} onPress={() => onSelect(item)} activeOpacity={0.7}>
                    <View style={m.repoIcon}>
                      <MaterialCommunityIcons name="github" size={13} color="#94A3B8" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={m.repoName} numberOfLines={1}>{item.full_name}</Text>
                      <Text style={m.repoMeta}>
                        {item.private ? '🔒 Private' : '🌐 Public'} · {item.default_branch}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#334155" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={m.empty}>No repositories found</Text>}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FadeSlideIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: object }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function AvatarStack({ primaryUrl, primaryInitials, secondaryInitials, tertiaryInitials }: {
  primaryUrl?: string | null;
  primaryInitials: string;
  secondaryInitials: string;
  tertiaryInitials: string;
}) {
  return (
    <View style={gh.avatarStack}>
      {primaryUrl ? (
        <Image source={{ uri: primaryUrl }} style={[gh.avatarStackItem, gh.avatarStackPrimary]} contentFit="cover" />
      ) : (
        <View style={[gh.avatarStackItem, gh.avatarStackPrimary, gh.avatarFallback]}>
          <Text style={gh.avatarFallbackText}>{primaryInitials}</Text>
        </View>
      )}
      <View style={[gh.avatarStackItem, gh.avatarStackSecondary]}>
        <Text style={gh.avatarFallbackText}>{secondaryInitials}</Text>
      </View>
      <View style={[gh.avatarStackItem, gh.avatarStackTertiary]}>
        <Text style={gh.avatarFallbackText}>{tertiaryInitials}</Text>
      </View>
    </View>
  );
}

function IssueGlassCard({ issue, repoFullName, index }: { issue: GitHubIssue; repoFullName: string; index: number }) {
  const status = issueStatusInfo(issue);
  const secondaryInitials = initialsFromName(issue.user.login).slice(0, 2) || 'GH';
  const tertiaryInitials = issue.number.toString().slice(-2);

  return (
    <FadeSlideIn delay={index * 60} style={gh.issueCardSpacing}>
      <TouchableOpacity activeOpacity={0.85} style={gh.issueCardWrap}>
        <BlurView intensity={22} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={gh.issueCard}>
          <View style={[gh.issueStateDot, { backgroundColor: status.color }]} />

          <View style={gh.issueMain}>
            <Text style={gh.issueTitle} numberOfLines={1}>{issue.title}</Text>
            <Text style={gh.issueRepo}>{repoFullName}</Text>

            <View style={gh.issueLabelRow}>
              {issue.labels.slice(0, 2).map(label => (
                <View
                  key={`${issue.id}-${label.id ?? label.name}`}
                  style={[
                    gh.issueLabel,
                    { backgroundColor: `#${label.color}1A`, borderColor: `#${label.color}40` },
                  ]}
                >
                  <Text style={[gh.issueLabelText, { color: `#${label.color}` }]} numberOfLines={1}>
                    {label.name}
                  </Text>
                </View>
              ))}
            </View>

            <View style={gh.issueFooterRow}>
              <Text style={gh.issueMetaText}>
                #{issue.number} {issue.state === 'open' ? 'opened' : 'closed'} {timeAgo(issue.updated_at)} by @{issue.user.login}
              </Text>
            </View>
          </View>

          <View style={gh.issueMetaSide}>
            <AvatarStack
              primaryUrl={issue.user.avatar_url}
              primaryInitials={secondaryInitials}
              secondaryInitials={tertiaryInitials}
              tertiaryInitials={repoFullName.slice(0, 2).toUpperCase()}
            />
            <View style={gh.commentPill}>
              <MaterialCommunityIcons name="message-reply-text-outline" size={11} color="rgba(255,255,255,0.75)" />
              <Text style={gh.commentPillText}>{issue.comments}</Text>
            </View>
          </View>

          <LinearGradient
            colors={['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.04)', 'rgba(88,166,255,0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={gh.issueSwipeHint}
          />
        </View>
      </TouchableOpacity>
    </FadeSlideIn>
  );
}

function NotificationGlassCard({ item, index }: { item: GitHubNotificationItem; index: number }) {
  const iconInfo = {
    'pull-request': { icon: 'source-pull', color: '#C084FC' },
    issue: { icon: 'alert-circle-outline', color: '#3fb950' },
    security: { icon: 'shield-outline', color: '#FBBF24' },
    release: { icon: 'tag-outline', color: '#60A5FA' },
  }[item.type];

  return (
    <FadeSlideIn delay={index * 60} style={gh.notificationSpacing}>
      <TouchableOpacity activeOpacity={0.85} style={[gh.notificationCardWrap, item.unread && gh.notificationCardUnreadWrap]}>
        <BlurView intensity={20} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={[gh.notificationCard, item.unread && gh.notificationCardUnread]}>
          <View style={[gh.notificationAccent, { backgroundColor: `${iconInfo.color}22` }]} />

          <View style={[gh.notificationIcon, { borderColor: `${iconInfo.color}44`, backgroundColor: `${iconInfo.color}12` }]}>
            <MaterialCommunityIcons name={iconInfo.icon as never} size={14} color={iconInfo.color} />
          </View>

          <View style={gh.notificationBody}>
            <Text style={gh.notificationTitle} numberOfLines={2}>{item.title}</Text>
            <View style={gh.notificationMetaRow}>
              <View style={gh.reasonPill}>
                <Text style={gh.reasonPillText}>{item.reason}</Text>
              </View>
              <Text style={gh.notificationTime}>{item.timestamp}</Text>
            </View>
          </View>

          <View style={gh.notificationRight}>
            <View style={[gh.unreadDotGlow, !item.unread && gh.unreadDotDim]}>
              <LinearGradient
                colors={item.unread ? ['#58a6ff', '#dbeafe'] : ['rgba(148,163,184,0.55)', 'rgba(148,163,184,0.18)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </View>

          <LinearGradient
            colors={['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.03)', 'rgba(88,166,255,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={gh.notificationSwipeHint}
          />
        </View>
      </TouchableOpacity>
    </FadeSlideIn>
  );
}

function MobileGitHubGlassShell({
  projectId,
  connection,
  user,
  issues,
  loading,
  onBack,
  onHome,
  onProfile,
  onRepoPicker,
}: {
  projectId: string;
  connection: ProjectGitHubConnection;
  user: GitHubUser | null;
  issues: GitHubIssue[];
  loading: boolean;
  onBack: () => void;
  onHome: () => void;
  onProfile: () => void;
  onRepoPicker: () => void;
}) {
  const insets = useSafeAreaInsets();
  const listRef = React.useRef<SectionList<any>>(null);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('open');
  const [activeTab, setActiveTab] = useState<'issues' | 'notifications'>('issues');

  const displayIssues = useMemo(() => (issues.length > 0 ? issues : MOCK_ISSUES), [issues]);
  const filteredIssues = useMemo(() => {
    if (issueFilter === 'all') return displayIssues;
    return displayIssues.filter((issue: GitHubIssue) => issue.state === issueFilter);
  }, [displayIssues, issueFilter]);

  const openIssueCount = useMemo(() => displayIssues.filter((issue: GitHubIssue) => issue.state === 'open').length, [displayIssues]);
  const notificationGroups = useMemo(() => buildNotificationGroups(connection.repoFullName), [connection.repoFullName]);
  const unreadCount = useMemo(
    () => notificationGroups.reduce((sum: number, group: GitHubNotificationGroup) => sum + group.unreadCount, 0),
    [notificationGroups],
  );

  const sections = useMemo(() => {
    const notificationSections = [
      { key: 'notifications-intro', kind: 'notifications-intro' as const, data: [] as never[] },
      ...notificationGroups.map((group: GitHubNotificationGroup) => ({
        key: group.repoFullName,
        kind: 'notifications' as const,
        repoFullName: group.repoFullName,
        unreadCount: group.unreadCount,
        data: group.items,
      })),
    ];

    return [
      { key: 'issues', kind: 'issues' as const, data: filteredIssues },
      ...notificationSections,
    ];
  }, [filteredIssues, notificationGroups]);

  const scrollToIssues = useCallback(() => {
    listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewOffset: 24 });
    setActiveTab('issues');
  }, []);

  const scrollToNotifications = useCallback(() => {
    listRef.current?.scrollToLocation({ sectionIndex: 1, itemIndex: 0, animated: true, viewOffset: 24 });
    setActiveTab('notifications');
  }, []);

  return (
    <View style={gh.shell}>
      <LinearGradient
        colors={['#0d1117', '#161b22', '#1a1f2e']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[gh.blobIssues, { top: insets.top + 68 }]} />
      <View style={gh.blobNotifications} />

      <View style={[gh.topBar, { paddingTop: insets.top + 10 }]}>
        <BlurView intensity={26} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={gh.topBarRow}>
          <TouchableOpacity onPress={onBack} style={gh.topBarAction} activeOpacity={0.8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="rgba(255,255,255,0.92)" />
          </TouchableOpacity>

          <View style={gh.topBarTitleWrap}>
            <Text style={gh.topBarTitle}>GitHub</Text>
            <Text style={gh.topBarSubtitle} numberOfLines={1}>{connection.repoFullName}</Text>
          </View>

          <TouchableOpacity onPress={scrollToNotifications} style={gh.topBarAction} activeOpacity={0.8}>
            <MaterialCommunityIcons name="bell-outline" size={18} color="rgba(255,255,255,0.92)" />
            {unreadCount > 0 && (
              <View style={gh.badgeBubble}>
                <Text style={gh.badgeBubbleText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        ref={listRef}
        sections={sections as any}
        keyExtractor={(item: any, index) => item?.id ? String(item.id) : `section-${index}`}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 110,
          paddingHorizontal: 14,
          paddingBottom: insets.bottom + 110,
        }}
        ListHeaderComponent={(
          <View style={gh.heroCardWrap}>
            <BlurView intensity={18} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
            <View style={gh.heroCard}>
              <View style={gh.heroCopy}>
                <Text style={gh.heroKicker}>Mobile GitHub</Text>
                <Text style={gh.heroTitle}>Issues and notifications in a liquid glass shell.</Text>
                <Text style={gh.heroSubCopy}>
                  Open issues and repo notifications are surfaced with a dark glassmorphism treatment tuned for compact screens.
                </Text>
              </View>

              <View style={gh.heroStatsRow}>
                <View style={gh.heroStatPill}>
                  <Text style={gh.heroStatValue}>{openIssueCount}</Text>
                  <Text style={gh.heroStatLabel}>open issues</Text>
                </View>
                <View style={gh.heroStatPill}>
                  <Text style={gh.heroStatValue}>{unreadCount}</Text>
                  <Text style={gh.heroStatLabel}>unread alerts</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        renderSectionHeader={({ section }) => {
          if (section.kind === 'issues') {
            return (
              <View style={gh.sectionWrap}>
                <View style={gh.sectionHeaderRow}>
                  <View style={gh.sectionTitleRow}>
                    <MaterialCommunityIcons name="circle-slice-8" size={15} color="#3fb950" />
                    <Text style={gh.sectionTitle}>Issues</Text>
                  </View>
                  <View style={gh.sectionActionsRow}>
                    <View style={gh.pillBadge}>
                      <Text style={gh.pillBadgeText}>{openIssueCount} open</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setIssueFilter((current) => (current === 'open' ? 'closed' : current === 'closed' ? 'all' : 'open'));
                      }}
                      style={gh.iconPill}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="filter-variant" size={14} color="rgba(255,255,255,0.88)" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={gh.filterRow}>
                  {(['open', 'closed', 'all'] as IssueFilter[]).map(filterValue => {
                    const isActive = issueFilter === filterValue;
                    return (
                      <TouchableOpacity
                        key={filterValue}
                        onPress={() => setIssueFilter(filterValue)}
                        style={[gh.filterPill, isActive && gh.filterPillActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[gh.filterPillText, isActive && gh.filterPillTextActive]}>
                          {filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }

          if (section.kind === 'notifications-intro') {
            return (
              <View style={gh.sectionIntroWrap}>
                <View style={gh.sectionHeaderRow}>
                  <View style={gh.sectionTitleRow}>
                    <MaterialCommunityIcons name="bell-outline" size={15} color="#58a6ff" />
                    <Text style={gh.sectionTitle}>Notifications</Text>
                  </View>
                  <View style={gh.sectionActionsRow}>
                    <View style={[gh.pillBadge, gh.pillBadgeBlue]}>
                      <Text style={gh.pillBadgeText}>{unreadCount} unread</Text>
                    </View>
                  </View>
                </View>
                <Text style={gh.sectionIntroText}>Grouped by repository with sticky glass headers.</Text>
              </View>
            );
          }

          if (section.kind === 'notifications') {
            return (
              <View style={gh.repoHeaderWrap}>
                <BlurView intensity={20} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
                <View style={gh.repoHeader}>
                  <View style={gh.repoHeaderLeft}>
                    <MaterialCommunityIcons name="github" size={14} color="rgba(255,255,255,0.92)" />
                    <Text style={gh.repoHeaderText} numberOfLines={1}>{section.repoFullName}</Text>
                  </View>
                  <View style={gh.repoUnreadPill}>
                    <Text style={gh.repoUnreadPillText}>{section.unreadCount} unread</Text>
                  </View>
                </View>
              </View>
            );
          }

          return null;
        }}
        renderItem={({ item, index, section }) => {
          if (section.kind === 'issues') {
            return <IssueGlassCard issue={item as GitHubIssue} repoFullName={connection.repoFullName} index={index} />;
          }

          if (section.kind === 'notifications') {
            return <NotificationGlassCard item={item as GitHubNotificationItem} index={index} />;
          }

          return null;
        }}
      />

      <View style={[gh.bottomBarWrap, { paddingBottom: insets.bottom + 10 }]}>
        <BlurView intensity={28} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={gh.bottomBar}>
          {[
            { key: 'home', icon: 'home-outline', label: 'Home', onPress: onHome },
            { key: 'issues', icon: 'circle-slice-8', label: 'Issues', onPress: scrollToIssues },
            { key: 'notifications', icon: 'bell-outline', label: 'Notifications', onPress: scrollToNotifications },
            { key: 'profile', icon: 'account-circle-outline', label: 'Profile', onPress: onProfile },
          ].map(tab => {
            const active = tab.key === activeTab;
            const issueTabActive = tab.key === 'issues' && activeTab === 'issues';
            const notificationTabActive = tab.key === 'notifications' && activeTab === 'notifications';
            const isActive = issueTabActive || notificationTabActive;

            return (
              <TouchableOpacity
                key={tab.key}
                onPress={tab.onPress}
                activeOpacity={0.8}
                style={gh.bottomTab}
              >
                <MaterialCommunityIcons
                  name={tab.icon as never}
                  size={19}
                  color={isActive ? '#58a6ff' : 'rgba(255,255,255,0.60)'}
                />
                <Text style={[gh.bottomTabLabel, isActive && gh.bottomTabLabelActive]}>{tab.label}</Text>
                {isActive && <View style={gh.bottomTabGlow} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GitHubScreen() {
  const { projectId, select_repo } = useLocalSearchParams<{ projectId: string; select_repo?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<ProjectGitHubConnection | null>(null);
  const [ghUser, setGhUser] = useState<GitHubUser | null>(null);

  const [prs, setPRs] = useState<GitHubPullRequest[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('prs');

  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [repoLoading, setRepoLoading] = useState(false);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Nav bar height (measured via onLayout for correct FlatList padding)
  const [navH, setNavH] = useState(0);

  // ── Load persisted state ─────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [tok, conn] = await Promise.all([
          getGitHubToken(),
          getProjectGitHubRepo(projectId),
        ]);
        if (!alive) return;
        setToken(tok);
        setConnection(conn);
      } catch (err) {
        console.error('Failed to load initial GitHub state:', err);
      }
    })();
    return () => { alive = false; };
  }, [projectId]);

  // Re-check connection on focus (Android: github-callback.tsx exchanges the code
  // and navigates back here; we need to refresh to show the connected state).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        try {
          const [tok, conn] = await Promise.all([
            getGitHubToken(),
            getProjectGitHubRepo(projectId),
          ]);
          if (!alive) return;
          setToken(tok);
          setConnection(conn);
        } catch (err) {
          console.error('Failed to load focus GitHub state:', err);
        }
      })();
      return () => { alive = false; };
    }, [projectId]),
  );

  // Load user profile when token is set/changes
  useEffect(() => {
    if (token) {
      void fetchGitHubUser(token)
        .then(user => setGhUser(user))
        .catch(() => {});
    }
  }, [token]);

  const loadRepos = useCallback(async () => {
    if (!token) return;
    setRepoLoading(true);
    setError(null);
    try {
      const data = await fetchRepositoriesWithToken(token);
      setRepos(data);
    } catch (err) {
      console.error('Failed to fetch repositories:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRepoLoading(false);
    }
  }, [token]);

  // Auto-open repo picker if redirected back with select_repo=1
  useEffect(() => {
    if (select_repo === '1' && token) {
      router.replace(`/github/${projectId}`);
      setShowRepoPicker(true);
      void loadRepos();
    }
  }, [select_repo, token, projectId, router, loadRepos]);

  // ── Load GitHub data ─────────────────────────────────────────────────────
  const loadData = useCallback(async (tok: string, conn: ProjectGitHubConnection) => {
    setLoading(true);
    setError(null);
    try {
      if (conn.integrationId) {
        await syncProjectGitHub(projectId).catch(() => {});
        const [prsRes, commitsRes, issuesRes, userRes] = await Promise.allSettled([
          fetchProjectPullRequests(projectId),
          fetchProjectCommits(projectId),
          fetchProjectIssues(projectId),
          fetchGitHubUser(tok),
        ]);
        if (prsRes.status === 'fulfilled') setPRs(prsRes.value);
        else setError(prsRes.reason instanceof Error ? prsRes.reason.message : String(prsRes.reason));
        if (commitsRes.status === 'fulfilled') setCommits(commitsRes.value);
        if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value);
        if (userRes.status === 'fulfilled') setGhUser(userRes.value);
        return;
      }

      const [prsRes, commitsRes, issuesRes, userRes] = await Promise.allSettled([
        fetchPullRequests(tok, conn.ownerLogin, conn.repoName),
        fetchCommits(tok, conn.ownerLogin, conn.repoName),
        fetchIssues(conn.repoFullName, tok),
        fetchGitHubUser(tok),
      ]);
      if (prsRes.status === 'fulfilled') setPRs(prsRes.value);
      else setError(prsRes.reason instanceof Error ? prsRes.reason.message : String(prsRes.reason));
      if (commitsRes.status === 'fulfilled') setCommits(commitsRes.value);
      if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value);
      if (userRes.status === 'fulfilled') setGhUser(userRes.value);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (token && connection) void loadData(token, connection);
  }, [token, connection, loadData]);

  // ── OAuth connect ────────────────────────────────────────────────────────
  // Platform split:
  //   iOS  → ASWebAuthenticationSession intercepts mobile://github-callback before
  //           Expo Router sees it, so the code comes back via result.url here.
  //   Android → Chrome Custom Tab fires the deep link to the router which navigates
  //           to app/github-callback.tsx; that page exchanges the code and comes back.
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const oauthConfig = await fetchGitHubOAuthConfig();
      if (!oauthConfig.configured || !oauthConfig.clientId) {
        setError('GitHub OAuth is not configured on the backend.');
        return;
      }
      const redirectUri = oauthConfig.redirectUri || DEFAULT_REDIRECT_URI;
      const authUrl =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${oauthConfig.clientId}&scope=repo&state=${projectId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      if (Platform.OS === 'ios') {
        // iOS: openAuthSessionAsync returns the redirect URL directly.
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (result.type === 'success' && result.url) {
          const code = new URL(result.url).searchParams.get('code');
          if (code) {
            const accessToken = await exchangeCodeForToken(code, redirectUri);
            if (accessToken) {
              await saveGitHubToken(accessToken);
              setToken(accessToken);
              const data = await fetchRepositoriesWithToken(accessToken).catch(() => []);
              setRepos(data);
              setShowRepoPicker(true);
            } else {
              setError('GitHub token exchange failed. Check the backend GitHub OAuth configuration.');
            }
          }
        }
      } else {
        // Android: open the browser; when GitHub redirects to mobile://github-callback
        // the OS fires a deep link and Expo Router navigates to app/github-callback.tsx
        // which handles the code exchange and navigates back here.
        await WebBrowser.openBrowserAsync(authUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, [projectId]);
  const handleSelectRepo = useCallback(async (repo: GitHubRepository) => {
    await setProjectGitHubRepo(projectId, repo);
    const conn = await getProjectGitHubRepo(projectId);
    setConnection(conn);
    setShowRepoPicker(false);
    setRepoSearch('');
    if (token && conn) void loadData(token, conn);
  }, [projectId, token, loadData]);

  const handleDisconnect = useCallback(async () => {
    try {
      await clearGitHubToken();
    } catch (err) {
      console.error('Failed to revoke GitHub token:', err);
    }
    await clearProjectGitHubRepo(projectId);
    setToken(null); setConnection(null); setGhUser(null);
    setPRs([]); setCommits([]); setIssues([]);
    setError(null);
  }, [projectId]);

  // ── Computed ─────────────────────────────────────────────────────────────
  const tabData =
    activeTab === 'prs' ? prs :
    activeTab === 'commits' ? commits :
    issues;

  // ── DISCONNECTED screen ──────────────────────────────────────────────────
  if (!connection || !token) {
    const isGitHubConnected = !!token;

    return (
      <LinearGradient
        colors={['#050B1A', '#0C0921', '#120820', '#080E1C']}
        style={StyleSheet.absoluteFill}
      >
        <StatusBar style="light" />
        <View style={[s.orb, { top: -80, left: '15%', width: 300, height: 300, backgroundColor: 'rgba(99,102,241,0.18)' }]} />
        <View style={[s.orb, { bottom: 60, right: '5%', width: 240, height: 240, backgroundColor: 'rgba(168,85,247,0.12)' }]} />

        <ScrollView
          contentContainerStyle={[s.disconnectContent, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>

          {/* Logo orb */}
          <View style={s.logoOrb}>
            <BlurView intensity={20} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
            <MaterialCommunityIcons name="github" size={46} color="#fff" />
          </View>

          <Text style={s.heroTitle}>
            {isGitHubConnected ? 'Link a Repository' : 'Connect to GitHub'}
          </Text>
          <Text style={s.heroSub}>
            {isGitHubConnected 
              ? 'Select a GitHub repository to track pull requests, commits, and issues for this project.'
              : 'Link this project to a repository to track pull requests, commits, and issues.'}
          </Text>

          {/* Connected User Profile Info (if connected) */}
          {isGitHubConnected && ghUser ? (
            <GlassCard style={{ width: '100%', marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
                {ghUser.avatar_url ? (
                  <Image source={{ uri: ghUser.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="account" size={20} color="rgba(255,255,255,0.6)" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{ghUser.name || ghUser.login}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>@{ghUser.login}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#34D399' }}>Connected</Text>
                </View>
              </View>
            </GlassCard>
          ) : !isGitHubConnected ? (
            /* Feature list (only show if not connected at all) */
            <GlassCard style={{ width: '100%', marginTop: 4 }}>
              {[
                { icon: 'source-pull' as const, text: 'View pull requests in real time' },
                { icon: 'source-commit' as const, text: 'Track commits and branch history' },
                { icon: 'alert-circle-outline' as const, text: 'Monitor open and closed issues' },
              ].map(f => (
                <View key={f.text} style={s.featureRow}>
                  <View style={s.featureIcon}>
                    <MaterialCommunityIcons name={f.icon} size={13} color="#34D399" />
                  </View>
                  <Text style={s.featureText}>{f.text}</Text>
                  <MaterialCommunityIcons name="check" size={13} color="#34D399" />
                </View>
              ))}
            </GlassCard>
          ) : null}

          {error ? (
            <View style={s.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#F87171" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {isGitHubConnected ? (
            <View style={{ width: '100%', gap: 14 }}>
              <TouchableOpacity
                onPress={() => { void loadRepos(); setShowRepoPicker(true); }}
                activeOpacity={0.85}
                style={s.connectWrap}
              >
                <LinearGradient
                  colors={['rgba(99,102,241,0.75)', 'rgba(168,85,247,0.65)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.connectBtn}
                >
                  <MaterialCommunityIcons name="link-variant" size={18} color="#fff" />
                  <Text style={s.connectText}>Select Repository</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDisconnect}
                activeOpacity={0.8}
                style={{ alignSelf: 'center', marginTop: 8 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#F87171' }}>
                  Disconnect Account
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleConnect}
              disabled={connecting}
              activeOpacity={0.85}
              style={s.connectWrap}
            >
              <LinearGradient
                colors={['rgba(99,102,241,0.75)', 'rgba(168,85,247,0.65)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.connectBtn}
              >
                {connecting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <MaterialCommunityIcons name="github" size={18} color="#fff" />}
                <Text style={s.connectText}>
                  {connecting ? 'Connecting…' : 'Connect to GitHub'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>

        <RepoPickerModal
          visible={showRepoPicker} repos={repos} loading={repoLoading}
          search={repoSearch} onSearch={setRepoSearch}
          onSelect={handleSelectRepo} onClose={() => setShowRepoPicker(false)}
        />
      </LinearGradient>
    );
  }

  // ── CONNECTED screen ─────────────────────────────────────────────────────
  return (
    <MobileGitHubGlassShell
      projectId={projectId}
      connection={connection}
      user={ghUser}
      issues={issues}
      loading={loading}
      onBack={() => router.back()}
      onHome={() => router.replace('/(tabs)' as never)}
      onProfile={() => router.push('/(tabs)/profile' as never)}
      onRepoPicker={() => { void loadRepos(); setShowRepoPicker(true); }}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Ambient
  orb: { position: 'absolute', borderRadius: 9999 },

  // Disconnect
  disconnectContent: { alignItems: 'center', paddingHorizontal: 28, gap: 16 },
  backBtn: { alignSelf: 'flex-start', width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoOrb: { width: 92, height: 92, borderRadius: 26, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20 }, android: { elevation: 10 } }) },
  heroTitle: { fontSize: 23, fontWeight: '900', color: '#F1F5F9', letterSpacing: -0.5, textAlign: 'center' },
  heroSub: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(52,211,153,0.08)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.18)', alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%', backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)', borderRadius: 12, padding: 12 },
  errorText: { flex: 1, fontSize: 12, color: '#F87171', lineHeight: 18 },
  connectWrap: { width: '100%', borderRadius: 18, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16 }, android: { elevation: 8 } }) },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, paddingHorizontal: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  connectText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  // Top nav (connected)
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, overflow: 'hidden', backgroundColor: 'rgba(5,11,26,0.6)' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  navBackBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  repoBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', minWidth: 0 },
  repoLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: '#CBD5E1', minWidth: 0 },
  visibilityChip: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, flexShrink: 0 },
  visibilityText: { fontSize: 10, fontWeight: '700' },
  navActions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  navActionBtn: { width: 33, height: 33, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  navMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingBottom: 10 },
  userAvatar: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  userLogin: { fontSize: 11, color: '#475569', fontWeight: '600' },
  branchPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  branchPillText: { fontSize: 10, color: '#334155', fontWeight: '600' },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabBtnActive: { backgroundColor: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.35)', ...Platform.select({ ios: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  tabText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  tabTextActive: { color: '#fff' },

  // List
  listPad: { paddingHorizontal: 14 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#1E293B', fontWeight: '600' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.18)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  retryText: { fontSize: 13, color: '#818CF8', fontWeight: '700' },

  // Cards
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 11, color: '#334155', fontWeight: '600' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', lineHeight: 20, marginBottom: 8 },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  branchText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  arrow: { fontSize: 11, color: '#1E293B' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  authorText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  shaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  shaText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#64748B', fontWeight: '600' },
});

const gh = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  blobIssues: {
    position: 'absolute',
    left: -24,
    width: 200,
    height: 200,
    borderRadius: 9999,
    backgroundColor: 'rgba(63,185,80,0.18)',
    opacity: 0.22,
    filter: 'blur(60px)' as any,
  },
  blobNotifications: {
    position: 'absolute',
    right: -28,
    top: 300,
    width: 220,
    height: 220,
    borderRadius: 9999,
    backgroundColor: 'rgba(88,166,255,0.18)',
    opacity: 0.18,
    filter: 'blur(60px)' as any,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,17,23,0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topBarRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  topBarAction: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleWrap: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.94)',
    letterSpacing: 0.2,
  },
  topBarSubtitle: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    maxWidth: 210,
    textAlign: 'center',
  },
  badgeBubble: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9999,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(88,166,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  badgeBubbleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  heroCardWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 24 },
      android: { elevation: 6 },
    }),
  },
  heroCard: {
    padding: 18,
    gap: 16,
  },
  heroCopy: {
    gap: 8,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.94)',
    letterSpacing: -0.5,
  },
  heroSubCopy: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.55)',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatPill: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.95)',
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.48)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionWrap: {
    marginBottom: 10,
    gap: 12,
  },
  sectionIntroWrap: {
    marginTop: 10,
    marginBottom: 10,
    gap: 10,
  },
  sectionIntroText: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.48)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
  },
  sectionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillBadgeBlue: {
    backgroundColor: 'rgba(88,166,255,0.12)',
    borderColor: 'rgba(88,166,255,0.22)',
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  iconPill: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(63,185,80,0.2)',
    borderColor: 'rgba(63,185,80,0.36)',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  repoHeaderWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  repoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  repoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  repoHeaderText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
  },
  repoUnreadPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: 'rgba(88,166,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.22)',
  },
  repoUnreadPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  issueCardSpacing: {
    marginBottom: 12,
  },
  issueCardWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 18 },
      android: { elevation: 5 },
    }),
  },
  issueCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    minHeight: 108,
  },
  issueStateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    shadowColor: '#3fb950',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  issueMain: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  issueTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.15,
  },
  issueRepo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.52)',
    fontWeight: '600',
  },
  issueLabelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  issueLabel: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  issueLabelText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  issueFooterRow: {
    marginTop: 2,
  },
  issueMetaText: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.42)',
    fontWeight: '600',
  },
  issueMetaSide: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  avatarStack: {
    width: 52,
    height: 52,
    position: 'relative',
    alignItems: 'flex-end',
  },
  avatarStackItem: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  avatarStackPrimary: {
    top: 0,
    left: 0,
    zIndex: 3,
  },
  avatarStackSecondary: {
    top: 13,
    left: 14,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  avatarStackTertiary: {
    top: 28,
    left: 28,
    zIndex: 1,
    backgroundColor: 'rgba(88,166,255,0.18)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  avatarFallbackText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  commentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.78)',
  },
  issueSwipeHint: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 64,
    bottom: 0,
  },
  notificationSpacing: {
    marginBottom: 10,
  },
  notificationCardWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notificationCardUnreadWrap: {
    borderColor: 'rgba(88,166,255,0.22)',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 88,
  },
  notificationCardUnread: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(88,166,255,0.6)',
  },
  notificationAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  notificationIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  notificationTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reasonPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reasonPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.76)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  notificationTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.48)',
    fontWeight: '600',
  },
  notificationRight: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
  },
  unreadDotGlow: {
    width: 8,
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#58a6ff',
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  unreadDotDim: {
    shadowOpacity: 0.2,
  },
  notificationSwipeHint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 72,
  },
  bottomBarWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(13,17,23,0.72)',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    position: 'relative',
  },
  bottomTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.58)',
  },
  bottomTabLabelActive: {
    color: 'rgba(255,255,255,0.94)',
  },
  bottomTabGlow: {
    position: 'absolute',
    bottom: 0,
    left: '24%',
    right: '24%',
    height: 2,
    borderRadius: 9999,
    backgroundColor: '#58a6ff',
    shadowColor: '#58a6ff',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
});

// ── Repo modal styles ─────────────────────────────────────────────────────────
const m = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,8,20,0.65)' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', backgroundColor: 'rgba(10,15,35,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  content: { flex: 1, padding: 20 },
  handle: { width: 38, height: 4, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: '#F1F5F9' },
  closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 11, paddingVertical: 9, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#E2E8F0', padding: 0 },
  repoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  repoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  repoName: { fontSize: 13, fontWeight: '700', color: '#CBD5E1' },
  repoMeta: { fontSize: 11, color: '#334155', marginTop: 2 },
  center: { paddingVertical: 28, alignItems: 'center' },
  empty: { fontSize: 13, color: '#334155', textAlign: 'center' },
});
