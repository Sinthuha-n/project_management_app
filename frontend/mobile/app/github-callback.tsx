import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fetchGitHubConnectionStatus } from '../src/services/githubMobileService';
import { getValidToken } from '../src/auth/storage';
import { githubOAuthErrorMessage, type GitHubOAuthResultCode } from '../src/services/githubOAuthCoordinator';

type ScreenState = 'checking' | 'success' | 'error';

export default function GitHubCallbackScreen() {
  const params = useLocalSearchParams<{
    result?: GitHubOAuthResultCode;
    destination?: 'profile' | 'project';
    projectId?: string;
  }>();
  const router = useRouter();
  const processed = useRef(false);
  const [screenState, setScreenState] = useState<ScreenState>('checking');
  const [message, setMessage] = useState('Confirming your GitHub connection…');

  const destination = params.destination === 'project' ? 'project' : 'profile';
  const destinationRoute = destination === 'project' && params.projectId
    ? `/github/${params.projectId}?select_repo=1`
    : '/(tabs)/profile';

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    void (async () => {
      if (params.result !== 'success') {
        setScreenState('error');
        setMessage(githubOAuthErrorMessage(params.result ?? 'exchange_failed'));
        return;
      }

      const token = await getValidToken();
      if (!token) {
        router.replace(`/(auth)/login?redirect=${encodeURIComponent(destinationRoute)}` as never);
        return;
      }

      try {
        const status = await fetchGitHubConnectionStatus();
        if (!status.connected) throw new Error('Connection is not available');
        setScreenState('success');
        setMessage(status.username ? `Connected as @${status.username}` : 'GitHub connected successfully.');
        setTimeout(() => router.replace(destinationRoute as never), 700);
      } catch {
        setScreenState('error');
        setMessage('GitHub was authorized, but Planora could not refresh the connection. Please try again.');
      }
    })();
  }, [destinationRoute, params.result, router]);

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <View style={styles.card}>
        {screenState === 'checking' && <ActivityIndicator size="large" color="#818CF8" />}
        {screenState === 'success' && <MaterialCommunityIcons name="check-circle" size={46} color="#34D399" />}
        {screenState === 'error' && <MaterialCommunityIcons name="alert-circle" size={46} color="#F87171" />}
        <Text style={styles.title}>{screenState === 'error' ? 'GitHub connection failed' : 'Connecting GitHub'}</Text>
        <Text style={styles.subtitle}>{message}</Text>
        {screenState === 'error' && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace(destinationRoute as never)}>
              <Text style={styles.primaryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(tabs)' as never)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 36, alignItems: 'center', gap: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#F1F5F9', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, color: '#CBD5E1', textAlign: 'center' },
  actions: { width: '100%', alignItems: 'center', gap: 16, marginTop: 8 },
  primaryButton: { width: '100%', backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  cancelText: { color: '#94A3B8', fontWeight: '600' },
});
