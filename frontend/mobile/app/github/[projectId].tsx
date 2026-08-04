import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GitHubActivity, openGitHubUrl } from '../../src/components/github/GitHubActivity';
import {
  AccountPicker,
  CollaboratorInviteSheet,
  ImportIssueSheet,
  RepositoryPicker,
} from '../../src/components/github/GitHubModals';
import { useGitHubProject } from '../../src/hooks/useGitHubProject';
import { connectGitHub, githubOAuthErrorMessage } from '../../src/services/githubOAuthCoordinator';
import {
  importGitHubIssue,
  inviteGitHubCollaborator,
  type CollaboratorPermission,
  type GitHubIssue,
  type GitHubRepository,
} from '../../src/services/githubMobileService';
import { routes } from '../../src/navigation/routes';

function StateView({ icon, title, message, action, actionLabel }: {
  icon: string; title: string; message: string; action?: () => void; actionLabel?: string;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}><MaterialCommunityIcons name={icon as never} size={36} color="#F0F6FC" /></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {action && <TouchableOpacity onPress={action} style={styles.primary}><Text style={styles.primaryText}>{actionLabel}</Text></TouchableOpacity>}
    </View>
  );
}

export default function GitHubScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const github = useGitHubProject(projectId);
  const { initialize } = github;
  const [repoPicker, setRepoPicker] = useState(false);
  const [accountPicker, setAccountPicker] = useState(false);
  const [inviteSheet, setInviteSheet] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [importIssue, setImportIssue] = useState<GitHubIssue | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { void initialize(); }, [initialize]));

  const startOAuth = async (loginHint?: string) => {
    setAccountPicker(false);
    const outcome = await connectGitHub({ destination: 'PROJECT', projectId, loginHint });
    if (outcome.type === 'success') await github.initialize();
    else if (outcome.type === 'error') Alert.alert('GitHub not connected', githubOAuthErrorMessage(outcome.code));
  };

  const connectAccount = () => {
    if (github.savedAccounts.length) setAccountPicker(true);
    else void startOAuth();
  };

  const openRepositories = async () => {
    await github.loadRepositories();
    setRepoPicker(true);
  };

  const chooseRepository = (repo: GitHubRepository) => {
    const apply = async () => {
      try {
        await github.selectRepository(repo);
        setRepoPicker(false);
      } catch (error: any) {
        Alert.alert('Repository not linked', error?.response?.data?.message ?? error?.message ?? 'Please try again.');
      }
    };
    if (github.connection && github.connection.repoFullName !== repo.full_name) {
      Alert.alert('Change repository?', `Replace ${github.connection.repoFullName} with ${repo.full_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', style: 'destructive', onPress: () => void apply() },
      ]);
    } else void apply();
  };

  const sendInvite = async (identifier: string, permission: CollaboratorPermission) => {
    setInviteLoading(true);
    setInviteError(null);
    try {
      const result = await inviteGitHubCollaborator(projectId, identifier, permission);
      Alert.alert(result.githubStatus === 201 ? 'Invitation sent' : 'Collaborator updated', result.message || `${identifier} now has ${permission} access.`);
      setInviteSheet(false);
    } catch (error: any) {
      setInviteError(error?.response?.data?.message ?? error?.message ?? 'The collaborator could not be invited.');
    } finally {
      setInviteLoading(false);
    }
  };

  const confirmImport = async () => {
    if (!importIssue || !github.connection) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const taskId = await importGitHubIssue(projectId, github.connection.repoFullName, importIssue.number);
      github.setImportedIssues(current => new Set(current).add(importIssue.number));
      setImportIssue(null);
      Alert.alert('Task created', `Issue #${importIssue.number} was imported as task ${taskId}.`, [
        { text: 'Stay' },
        { text: 'Open board', onPress: () => router.push(routes.project(projectId, 'board')) },
      ]);
    } catch (error: any) {
      setImportError(error?.response?.data?.message ?? error?.message ?? 'The issue could not be imported.');
    } finally {
      setImportLoading(false);
    }
  };

  if (github.routeState !== 'connected' || !github.connection) {
    let content = <StateView icon="alert-circle-outline" title="Unable to load GitHub" message={github.error || 'Please try again.'} action={() => void github.initialize()} actionLabel="Retry" />;
    if (github.routeState === 'initializing') content = <View style={styles.state}><ActivityIndicator color="#58A6FF" size="large" /><Text style={styles.stateMessage}>Checking GitHub connection…</Text></View>;
    if (github.routeState === 'needsAccount') content = <StateView icon="github" title="Connect to GitHub" message="Connect your account to browse repositories and project activity." action={connectAccount} actionLabel="Connect GitHub" />;
    if (github.routeState === 'needsRepository') content = <StateView icon="source-repository" title="Choose a repository" message="Your GitHub account is connected. Link a repository to this project." action={() => void openRepositories()} actionLabel="Choose repository" />;
    if (github.routeState === 'offline') content = <StateView icon="cloud-off-outline" title="You’re offline" message="Cached repository details are unavailable. Reconnect and retry." action={() => void github.initialize()} actionLabel="Retry" />;
    return (
      <LinearGradient colors={['#0D1117', '#161B22', '#0D1117']} style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={22} color="#F0F6FC" /></TouchableOpacity>
        {content}
        <RepositoryPicker visible={repoPicker} repositories={github.repositories} loading={github.loadingRepositories} onClose={() => setRepoPicker(false)} onSelect={chooseRepository} />
        <AccountPicker visible={accountPicker} accounts={github.savedAccounts} onClose={() => setAccountPicker(false)} onSelect={login => void startOAuth(login)} onAdd={() => void startOAuth('')} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0D1117', '#161B22', '#0D1117']} style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36, paddingHorizontal: 14 }}
        refreshControl={<RefreshControl tintColor="#58A6FF" refreshing={github.loading} onRefresh={() => void github.loadActivity(github.connection!, true)} />}
      >
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}><MaterialCommunityIcons name="arrow-left" size={20} color="#F0F6FC" /></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={styles.headerTitle}>GitHub</Text><Text style={styles.headerRepo} numberOfLines={1}>{github.connection.repoFullName}</Text></View>
          <TouchableOpacity onPress={() => void github.loadActivity(github.connection!, true)} style={styles.iconButton}><MaterialCommunityIcons name="refresh" size={19} color="#C9D1D9" /></TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.accountRow}>
            {github.user?.avatar_url ? <Image source={{ uri: github.user.avatar_url }} style={styles.avatar} /> : <MaterialCommunityIcons name="github" size={38} color="#F0F6FC" />}
            <View style={{ flex: 1 }}><Text style={styles.heroTitle}>{github.connection.repoName}</Text><Text style={styles.heroSub}>@{github.user?.login} · {github.connection.private ? 'Private' : 'Public'} · {github.connection.defaultBranch}</Text></View>
            <TouchableOpacity accessibilityRole="link" onPress={() => void openGitHubUrl(github.connection?.repositoryUrl || `https://github.com/${github.connection?.repoFullName}`)} style={styles.iconButton}><MaterialCommunityIcons name="open-in-new" size={18} color="#58A6FF" /></TouchableOpacity>
          </View>
          <View style={styles.stats}>
            <View><Text style={styles.statValue}>{github.stats?.openPullRequests ?? github.pullRequests.filter(item => item.state === 'open').length}</Text><Text style={styles.statLabel}>open PRs</Text></View>
            <View><Text style={styles.statValue}>{github.stats?.totalCommits ?? github.commits.length}</Text><Text style={styles.statLabel}>commits</Text></View>
            <View><Text style={styles.statValue}>{github.stats?.openIssues ?? github.issues.filter(item => item.state === 'open').length}</Text><Text style={styles.statLabel}>open issues</Text></View>
            <View><Text style={styles.statValue}>{github.unreadNotifications}</Text><Text style={styles.statLabel}>unread</Text></View>
          </View>
          {github.canManage && <View style={styles.actions}><TouchableOpacity onPress={() => void openRepositories()} style={styles.secondary}><Text style={styles.secondaryText}>Change repo</Text></TouchableOpacity><TouchableOpacity onPress={() => setInviteSheet(true)} style={styles.secondary}><Text style={styles.secondaryText}>Invite</Text></TouchableOpacity></View>}
          <View style={styles.actions}><TouchableOpacity onPress={() => setAccountPicker(true)} style={styles.secondary}><Text style={styles.secondaryText}>Switch account</Text></TouchableOpacity><TouchableOpacity onPress={() => Alert.alert('Disconnect GitHub?', 'The project repository link will be preserved.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: () => void github.disconnectAccount() }])} style={styles.secondary}><Text style={[styles.secondaryText, { color: '#F85149' }]}>Disconnect</Text></TouchableOpacity></View>
        </View>

        {!github.isOnline && <Text style={styles.warning}>Offline · showing the last loaded GitHub data</Text>}
        {!!github.activityError && <Text style={styles.warning}>{github.activityError}</Text>}
        {!!github.realtime.error && <Text style={styles.warning}>{github.realtime.error}</Text>}
        {github.latestCi && <TouchableOpacity onPress={() => github.setLatestCi(null)} style={[styles.notice, { borderColor: github.latestCi.status === 'failure' ? '#F85149' : github.latestCi.status === 'success' ? '#3FB950' : '#D29922' }]}><Text style={styles.noticeText}>CI {github.latestCi.status}: {github.latestCi.workflow} · {github.latestCi.branch}</Text><MaterialCommunityIcons name="close" size={15} color="#8B949E" /></TouchableOpacity>}
        {github.liveNotice && <TouchableOpacity onPress={() => github.setLiveNotice(null)} style={styles.notice}><Text style={styles.noticeText}>{github.liveNotice}</Text><MaterialCommunityIcons name="close" size={15} color="#8B949E" /></TouchableOpacity>}

        <GitHubActivity
          pullRequests={github.pullRequests}
          commits={github.commits}
          issues={github.issues}
          notifications={github.notifications}
          importedIssues={github.importedIssues}
          onImport={issue => { setImportError(null); setImportIssue(issue); }}
          onReadNotification={id => void github.markNotification(id)}
          onReadAll={() => void github.markAllNotifications()}
        />
      </ScrollView>

      <RepositoryPicker visible={repoPicker} repositories={github.repositories} loading={github.loadingRepositories} current={github.connection.repoFullName} onClose={() => setRepoPicker(false)} onSelect={chooseRepository} />
      <AccountPicker visible={accountPicker} accounts={github.savedAccounts} onClose={() => setAccountPicker(false)} onSelect={login => void startOAuth(login)} onAdd={() => void startOAuth('')} />
      <CollaboratorInviteSheet visible={inviteSheet} members={github.members} loading={inviteLoading} error={inviteError} onClose={() => setInviteSheet(false)} onInvite={(identifier, permission) => void sendInvite(identifier, permission)} />
      <ImportIssueSheet visible={Boolean(importIssue)} issue={importIssue} loading={importLoading} error={importError} onClose={() => setImportIssue(null)} onImport={() => void confirmImport()} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, back: { margin: 14, width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.06)' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }, stateIcon: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(88,166,255,.12)', borderWidth: 1, borderColor: 'rgba(88,166,255,.24)' }, stateTitle: { color: '#F0F6FC', fontSize: 23, fontWeight: '900', textAlign: 'center' }, stateMessage: { color: '#8B949E', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primary: { backgroundColor: '#1F6FEB', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13 }, primaryText: { color: '#FFF', fontWeight: '800' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, iconButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.06)', borderWidth: 1, borderColor: 'rgba(240,246,252,.1)' }, headerTitle: { color: '#F0F6FC', fontSize: 18, fontWeight: '900' }, headerRepo: { color: '#8B949E', fontSize: 11, marginTop: 2 },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(240,246,252,.12)', backgroundColor: 'rgba(22,27,34,.86)', padding: 16 }, accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 44, height: 44, borderRadius: 22 }, heroTitle: { color: '#F0F6FC', fontSize: 20, fontWeight: '900' }, heroSub: { color: '#8B949E', fontSize: 11, marginTop: 3 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(240,246,252,.08)' }, statValue: { color: '#F0F6FC', fontSize: 18, fontWeight: '900', textAlign: 'center' }, statLabel: { color: '#6E7681', fontSize: 10, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 }, secondary: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#30363D', backgroundColor: '#0D1117' }, secondaryText: { color: '#C9D1D9', fontSize: 11, fontWeight: '800' },
  warning: { color: '#D29922', backgroundColor: 'rgba(210,153,34,.1)', borderWidth: 1, borderColor: 'rgba(210,153,34,.25)', borderRadius: 12, padding: 10, marginTop: 10, fontSize: 11 }, notice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#388BFD', backgroundColor: 'rgba(56,139,253,.1)', borderRadius: 12, padding: 10, marginTop: 10 }, noticeText: { flex: 1, color: '#C9D1D9', fontSize: 11, fontWeight: '700' },
});
