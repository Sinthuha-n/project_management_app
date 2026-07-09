import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { T } from '@/src/constants/tokens';
import { getValidToken } from '@/src/auth/storage';
import { projectService } from '@/src/services/project-service';
import { routes } from '@/src/navigation/routes';
import { apiErrorMessage } from '@/src/utils/apiError';

type State = 'loading' | 'success' | 'error' | 'auth';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const inviteToken = Array.isArray(token) ? token[0] : token;
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('Accepting invitation...');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!inviteToken) {
        setState('error');
        setMessage('This invite link is missing its token.');
        return;
      }

      const authToken = await getValidToken();
      if (!authToken) {
        setState('auth');
        setMessage('Sign in first, then we will bring you back to this invite.');
        return;
      }

      try {
        await projectService.acceptInvitation(inviteToken);
        if (cancelled) return;
        setState('success');
        setMessage('Invitation accepted. You can now open the project from Spaces.');
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setMessage(apiErrorMessage(err, 'Invitation could not be accepted.'));
      }
    })();

    return () => { cancelled = true; };
  }, [inviteToken]);

  const icon =
    state === 'success' ? 'check-circle-outline' :
    state === 'error' ? 'alert-circle-outline' :
    state === 'auth' ? 'login' :
    'email-fast-outline';

  const iconColor = state === 'success' ? '#16A34A' : state === 'error' ? '#DC2626' : T.primary;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: `${iconColor}14` }]}>
          {state === 'loading' ? (
            <ActivityIndicator color={T.primary} />
          ) : (
            <MaterialCommunityIcons name={icon} size={34} color={iconColor} />
          )}
        </View>
        <Text style={styles.title}>
          {state === 'success' ? 'Invite Accepted' : state === 'error' ? 'Invite Problem' : state === 'auth' ? 'Sign In Required' : 'Accepting Invite'}
        </Text>
        <Text style={styles.message}>{message}</Text>

        {state === 'auth' ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace(`/(auth)/login?redirect=${encodeURIComponent(String(routes.acceptInvite(inviteToken)))}` as never)}
          >
            <Text style={styles.primaryText}>Sign In</Text>
          </TouchableOpacity>
        ) : null}

        {state === 'success' ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace(routes.spaces)}>
            <Text style={styles.primaryText}>Open Spaces</Text>
          </TouchableOpacity>
        ) : null}

        {state === 'error' ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace(routes.tabs)}>
            <Text style={styles.secondaryText}>Back Home</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bgSecondary, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg,
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '900', color: T.textPrimary, letterSpacing: -0.4, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, color: T.textSecondary, textAlign: 'center', marginBottom: 8 },
  primaryBtn: { width: '100%', backgroundColor: T.primary, borderRadius: 14, alignItems: 'center', paddingVertical: 13 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondaryBtn: { width: '100%', backgroundColor: T.bgSecondary, borderRadius: 14, borderWidth: 1, borderColor: T.border, alignItems: 'center', paddingVertical: 13 },
  secondaryText: { color: T.textPrimary, fontWeight: '900', fontSize: 15 },
});
