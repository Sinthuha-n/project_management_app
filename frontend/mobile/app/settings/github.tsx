import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { connectGitHub, githubOAuthErrorMessage } from '../../src/services/githubOAuthCoordinator';
import {
  fetchGitHubConnectionStatus,
  fetchGitHubUser,
  fetchRepositoriesWithToken,
  type GitHubRepository,
  type GitHubUser,
} from '../../src/services/githubMobileService';

export default function GitHubSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const status = await fetchGitHubConnectionStatus();
      if (!status.connected) { setUser(null); setRepositories([]); return; }
      const [githubUser, repos] = await Promise.all([fetchGitHubUser(), fetchRepositoriesWithToken()]);
      setUser(githubUser); setRepositories(repos);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? requestError?.message ?? 'GitHub repositories could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const connect = async () => {
    const result = await connectGitHub({ destination: 'PROFILE' });
    if (result.type === 'success') void load();
    else if (result.type === 'error') setError(githubOAuthErrorMessage(result.code));
  };

  return (
    <LinearGradient colors={['#0D1117', '#161B22', '#0D1117']} style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28, paddingHorizontal: 16 }} refreshControl={<RefreshControl tintColor="#58A6FF" refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.icon}><MaterialCommunityIcons name="arrow-left" size={21} color="#F0F6FC" /></TouchableOpacity><View><Text style={styles.title}>GitHub Settings</Text><Text style={styles.sub}>Connected repositories and default branches</Text></View></View>
        {!user && !loading ? <View style={styles.empty}><MaterialCommunityIcons name="github" size={42} color="#F0F6FC" /><Text style={styles.emptyTitle}>Connect GitHub</Text><Text style={styles.sub}>Authorize Planora to list your repositories.</Text><TouchableOpacity onPress={() => void connect()} style={styles.primary}><Text style={styles.primaryText}>Connect account</Text></TouchableOpacity></View> : null}
        {user && <View style={styles.account}><MaterialCommunityIcons name="github" size={30} color="#F0F6FC" /><View><Text style={styles.accountName}>{user.name || user.login}</Text><Text style={styles.sub}>@{user.login} · {repositories.length} repositories</Text></View></View>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {loading && repositories.length === 0 ? <ActivityIndicator color="#58A6FF" style={{ marginTop: 40 }} /> : repositories.map(repo => <View key={repo.id} style={styles.repo}><MaterialCommunityIcons name={repo.private ? 'lock-outline' : 'earth'} size={18} color="#8B949E" /><View style={{ flex: 1 }}><Text style={styles.repoName}>{repo.full_name}</Text><Text style={styles.sub}>Branch: {repo.default_branch}</Text></View><Text style={styles.visibility}>{repo.private ? 'Private' : 'Public'}</Text></View>)}
        {user && !loading && repositories.length === 0 && <Text style={styles.noRepos}>No repositories are available for this account.</Text>}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }, icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.06)', alignItems: 'center', justifyContent: 'center' }, title: { color: '#F0F6FC', fontSize: 21, fontWeight: '900' }, sub: { color: '#8B949E', fontSize: 11, marginTop: 3 },
  empty: { alignItems: 'center', gap: 10, padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#30363D', backgroundColor: 'rgba(22,27,34,.85)' }, emptyTitle: { color: '#F0F6FC', fontSize: 19, fontWeight: '900' }, primary: { marginTop: 8, backgroundColor: '#1F6FEB', borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12 }, primaryText: { color: '#FFF', fontWeight: '800' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: '#30363D', backgroundColor: '#161B22', padding: 14, marginBottom: 12 }, accountName: { color: '#F0F6FC', fontSize: 15, fontWeight: '800' },
  repo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#30363D', backgroundColor: 'rgba(22,27,34,.82)', padding: 14, marginBottom: 8 }, repoName: { color: '#F0F6FC', fontSize: 13, fontWeight: '800' }, visibility: { color: '#8B949E', fontSize: 10, borderWidth: 1, borderColor: '#30363D', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }, error: { color: '#F85149', backgroundColor: 'rgba(248,81,73,.1)', padding: 11, borderRadius: 12, marginBottom: 10 }, noRepos: { color: '#8B949E', textAlign: 'center', marginTop: 30 },
});
